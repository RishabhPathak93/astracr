"""projects/views.py"""
import logging
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q

from .models import Project, ProjectUpdate, ProjectDocument
from .serializers import (
    ProjectListSerializer, ProjectDetailSerializer,
    ProjectUpdateSerializer, ProjectDocumentSerializer,
)
from accounts.permissions import IsAdminOrManager, IsAdminOrManagerOrReadOnly
from accounts.models import User
from notifications.utils import notify_project_team, notify_admins_and_managers

logger = logging.getLogger('nexus')


def _project_team(project, exclude=None):
    """Manager + all assigned resources for a project, deduped."""
    seen, result = set(), []
    candidates = list(project.resources.filter(is_active=True))
    if project.manager:
        candidates.append(project.manager)
    for u in candidates:
        if u.id not in seen and u != exclude:
            seen.add(u.id)
            result.append(u)
    return result


class ProjectViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields   = ['status', 'priority', 'client', 'manager']
    search_fields      = ['name', 'description']
    ordering_fields    = ['name', 'created_at', 'end_date', 'priority', 'progress', 'budget']

    def get_queryset(self):
        user = self.request.user
        base = (
            Project.objects
            .select_related('client', 'manager', 'created_by')
            .prefetch_related('resources', 'updates', 'documents')
        )
        if user.role in (User.Role.ADMIN, User.Role.MANAGER):
            return base.all()
        if user.role == User.Role.RESOURCE:
            return base.filter(resources=user)
        return base.none()

    def get_serializer_class(self):
        return ProjectListSerializer if self.action == 'list' else ProjectDetailSerializer

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAdminOrManager()]
        return [IsAuthenticated()]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    def perform_create(self, serializer):
        project = serializer.save(created_by=self.request.user)
        logger.info('Project "%s" created by %s', project.name, self.request.user.email)
        # All admins + managers (minus creator) + assigned resources
        recipients = list(User.objects.filter(
            role__in=[User.Role.ADMIN, User.Role.MANAGER], is_active=True
        ))
        for r in project.resources.filter(is_active=True):
            if r not in recipients:
                recipients.append(r)
        notify_project_team(
            users=recipients,
            notif_type='project_assigned',
            title=f'New project: {project.name}',
            message=f'Project "{project.name}" has been created for client {project.client.name}.',
            project=project,
            action_url=f'/projects/{project.id}',
        )

    def perform_update(self, serializer):
        old_status   = self.get_object().status
        old_progress = self.get_object().progress
        project      = serializer.save()

        if old_status != project.status:
            notify_project_team(
                users=_project_team(project),
                notif_type='status_change',
                title=f'Project status changed: {project.name}',
                message=f'"{project.name}" is now {project.get_status_display()}.',
                project=project,
                action_url=f'/projects/{project.id}',
            )

        if old_progress != 100 and project.progress == 100:
            notify_project_team(
                users=_project_team(project),
                notif_type='timeline_complete',
                title=f'Project completed: {project.name}',
                message=f'"{project.name}" has reached 100% progress.',
                project=project,
                action_url=f'/projects/{project.id}',
            )

    def perform_destroy(self, instance):
        name = instance.name
        notify_project_team(
            users=_project_team(instance),
            notif_type='status_change',
            title='Project deleted',
            message=f'The project "{name}" has been removed.',
        )
        instance.delete()
        logger.warning('Project "%s" deleted by %s', name, self.request.user.email)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrManager])
    def add_update(self, request, pk=None):
        project    = self.get_object()
        serializer = ProjectUpdateSerializer(data={**request.data, 'project': project.id})
        serializer.is_valid(raise_exception=True)
        serializer.save(author=request.user, project=project)
        notify_project_team(
            users=_project_team(project),
            notif_type='update',
            title=f'Update on "{project.name}"',
            message=request.data.get('content', '')[:140] or f'A new update was posted on "{project.name}".',
            project=project,
            action_url=f'/projects/{project.id}',
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def upload_document(self, request, pk=None):
        project    = self.get_object()
        serializer = ProjectDocumentSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(uploaded_by=request.user, project=project)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'], permission_classes=[IsAdminOrManager])
    def update_progress(self, request, pk=None):
        project = self.get_object()
        raw = request.data.get('progress')
        try:
            value = int(raw)
            if not (0 <= value <= 100):
                raise ValueError
        except (ValueError, TypeError):
            return Response({'detail': 'progress must be an integer 0–100.'}, status=status.HTTP_400_BAD_REQUEST)
        old_progress = project.progress
        project.progress = value
        project.save(update_fields=['progress', 'updated_at'])
        if old_progress != 100 and value == 100:
            notify_project_team(
                users=_project_team(project),
                notif_type='timeline_complete',
                title=f'Project completed: {project.name}',
                message=f'"{project.name}" has reached 100% progress.',
                project=project,
                action_url=f'/projects/{project.id}',
            )
        return Response({'id': project.id, 'progress': project.progress})

    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrManager])
    def assign_resource(self, request, pk=None):
        project = self.get_object()
        try:
            user = User.objects.get(pk=request.data.get('user_id'), role=User.Role.RESOURCE, is_active=True)
        except User.DoesNotExist:
            return Response({'detail': 'Active resource user not found.'}, status=status.HTTP_404_NOT_FOUND)
        project.resources.add(user)
        notify_project_team(
            users=[user],
            notif_type='project_assigned',
            title=f'Added to project: {project.name}',
            message=f'You have been assigned to "{project.name}".',
            project=project,
            action_url=f'/projects/{project.id}',
        )
        return Response({'detail': f'{user.name} added to project.'})

    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrManager])
    def remove_resource(self, request, pk=None):
        project = self.get_object()
        try:
            user = User.objects.get(pk=request.data.get('user_id'))
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
        project.resources.remove(user)
        notify_project_team(
            users=[user],
            notif_type='status_change',
            title=f'Removed from project: {project.name}',
            message=f'You have been removed from "{project.name}".',
            project=project,
        )
        return Response({'detail': f'{user.name} removed from project.'})