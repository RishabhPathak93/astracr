"""timelines/views.py"""
import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from django.utils import timezone

from django.db.models import Avg
from .models import Timeline, TimelineMilestone
from .serializers import TimelineSerializer, TimelineMilestoneSerializer
from accounts.permissions import IsAdminOrManagerOrReadOnly
from notifications.utils import notify_project_team


def _sync_project_progress(project):
    """Recalculate project progress as average of its phases."""
    if not project:
        return
    avg = Timeline.objects.filter(project=project).aggregate(a=Avg('progress'))['a']
    if avg is not None:
        project.progress = round(avg)
        project.save(update_fields=['progress'])

logger = logging.getLogger('nexus')


def _timeline_team(timeline, exclude=None):
    """Assignees (resources) + project manager, deduped."""
    seen, result = set(), []
    candidates = list(timeline.assignees.filter(is_active=True))
    if timeline.project.manager:
        candidates.append(timeline.project.manager)
    for u in candidates:
        if u.id not in seen and u != exclude:
            seen.add(u.id)
            result.append(u)
    return result


class TimelineViewSet(viewsets.ModelViewSet):
    queryset = Timeline.objects.select_related('project__manager').prefetch_related('assignees', 'milestones')
    serializer_class   = TimelineSerializer
    permission_classes = [IsAdminOrManagerOrReadOnly]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields   = ['project', 'status']
    search_fields      = ['name', 'description']
    ordering_fields    = ['order', 'start_date', 'end_date', 'progress']

    def perform_create(self, serializer):
        tl = serializer.save()
        logger.info('Timeline "%s" created for project "%s"', tl.name, tl.project.name)
        assignees = list(tl.assignees.filter(is_active=True))
        if assignees:
            notify_project_team(
                users=assignees,
                notif_type='project_assigned',
                title=f'Assigned to phase: {tl.name}',
                message=f'You have been assigned to the "{tl.name}" phase in "{tl.project.name}".',
                project=tl.project,
                action_url='/timelines',
            )

    def perform_update(self, serializer):
        old = self.get_object()
        old_assignee_ids = set(old.assignees.values_list('id', flat=True))
        tl  = serializer.save()
        _sync_project_progress(tl.project)

        if old.status != tl.status:
            notif_type = 'timeline_complete' if tl.status == Timeline.Status.COMPLETED else 'status_change'
            title = f'Phase completed: {tl.name}' if tl.status == Timeline.Status.COMPLETED else f'Phase status changed: {tl.name}'
            message = (
                f'The "{tl.name}" phase in "{tl.project.name}" is now complete.'
                if tl.status == Timeline.Status.COMPLETED
                else f'"{tl.name}" in "{tl.project.name}" is now {tl.get_status_display()}.'
            )
            notify_project_team(
                users=_timeline_team(tl),
                notif_type=notif_type,
                title=title,
                message=message,
                project=tl.project,
                action_url='/timelines',
            )

        # Notify newly added assignees
        new_assignee_ids = set(tl.assignees.values_list('id', flat=True)) - old_assignee_ids
        if new_assignee_ids:
            from accounts.models import User
            new_members = list(User.objects.filter(pk__in=new_assignee_ids, is_active=True))
            notify_project_team(
                users=new_members,
                notif_type='project_assigned',
                title=f'Assigned to phase: {tl.name}',
                message=f'You have been assigned to "{tl.name}" in "{tl.project.name}".',
                project=tl.project,
                action_url='/timelines',
            )

    @action(detail=True, methods=['patch'])
    def update_progress(self, request, pk=None):
        tl = self.get_object()
        raw = request.data.get('progress')
        try:
            value = int(raw)
            assert 0 <= value <= 100
        except (TypeError, ValueError, AssertionError):
            return Response({'detail': 'progress must be an integer 0–100.'}, status=status.HTTP_400_BAD_REQUEST)
        old_status = tl.status
        tl.progress = value
        if value == 100:
            tl.status = Timeline.Status.COMPLETED
        elif value > 0:
            tl.status = Timeline.Status.IN_PROGRESS
        tl.save(update_fields=['progress', 'status', 'updated_at'])
        _sync_project_progress(tl.project)
        if old_status != tl.status and tl.status == Timeline.Status.COMPLETED:
            notify_project_team(
                users=_timeline_team(tl),
                notif_type='timeline_complete',
                title=f'Phase completed: {tl.name}',
                message=f'The "{tl.name}" phase in "{tl.project.name}" has reached 100%.',
                project=tl.project,
                action_url='/timelines',
            )
        return Response({'progress': tl.progress, 'status': tl.status})

    @action(detail=True, methods=['post'])
    def add_milestone(self, request, pk=None):
        tl = self.get_object()
        s  = TimelineMilestoneSerializer(data={**request.data, 'timeline': tl.id})
        s.is_valid(raise_exception=True)
        milestone = s.save(timeline=tl)
        notify_project_team(
            users=_timeline_team(tl),
            notif_type='deadline',
            title=f'New milestone: {milestone.title}',
            message=f'Milestone "{milestone.title}" (due {milestone.due_date}) added to "{tl.name}" in "{tl.project.name}".',
            project=tl.project,
            action_url='/timelines',
        )
        return Response(s.data, status=status.HTTP_201_CREATED)


class MilestoneViewSet(viewsets.ModelViewSet):
    queryset = TimelineMilestone.objects.select_related('timeline__project__manager').prefetch_related('timeline__assignees')
    serializer_class   = TimelineMilestoneSerializer
    permission_classes = [IsAdminOrManagerOrReadOnly]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ['timeline', 'completed']

    @action(detail=True, methods=['patch'])
    def complete(self, request, pk=None):
        m = self.get_object()
        m.completed    = True
        m.completed_at = timezone.now()
        m.save(update_fields=['completed', 'completed_at'])
        notify_project_team(
            users=_timeline_team(m.timeline),
            notif_type='timeline_complete',
            title=f'Milestone hit: {m.title}',
            message=f'"{m.title}" in "{m.timeline.name}" ({m.timeline.project.name}) has been completed.',
            project=m.timeline.project,
            action_url='/timelines',
        )
        return Response(TimelineMilestoneSerializer(m).data)