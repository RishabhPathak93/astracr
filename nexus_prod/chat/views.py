"""chat/views.py"""
import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from .models import ChatRoom, Message
from .serializers import ChatRoomSerializer, MessageSerializer
from accounts.models import User

logger = logging.getLogger('nexus')


class ChatRoomViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only REST interface — writing happens through WebSocket."""
    serializer_class   = ChatRoomSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs   = ChatRoom.objects.select_related('project').prefetch_related('members')
        if user.role in (User.Role.ADMIN, User.Role.MANAGER):
            return qs.all()
        return qs.filter(members=user)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        room   = self.get_object()
        limit  = min(int(request.query_params.get('limit', 50)), 200)
        before = request.query_params.get('before')
        qs     = room.messages.select_related('sender').order_by('-created_at')
        if before:
            try:
                qs = qs.filter(pk__lt=int(before))
            except ValueError:
                pass
        msgs = list(reversed(list(qs[:limit])))
        return Response(MessageSerializer(msgs, many=True, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        room   = self.get_object()
        unread = room.messages.exclude(sender=request.user).exclude(read_by=request.user)
        for msg in unread:
            msg.read_by.add(request.user)
        return Response({'marked_read': unread.count()})

    @action(detail=True, methods=['post'])
    def send_message(self, request, pk=None):
        """REST fallback for environments that can't use WebSocket."""
        room       = self.get_object()
        serializer = MessageSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(sender=request.user, room=room)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
