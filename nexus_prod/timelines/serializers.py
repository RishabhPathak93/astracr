"""timelines/serializers.py"""
from rest_framework import serializers
from .models import Timeline, TimelineMilestone
from accounts.serializers import UserSerializer


class TimelineMilestoneSerializer(serializers.ModelSerializer):
    class Meta:
        model  = TimelineMilestone
        fields = ['id', 'timeline', 'title', 'due_date', 'completed', 'completed_at', 'created_at']
        read_only_fields = ['id', 'created_at']


class TimelineSerializer(serializers.ModelSerializer):
    assignee_details = UserSerializer(source='assignees', many=True, read_only=True)
    milestones       = TimelineMilestoneSerializer(many=True, read_only=True)
    duration_days    = serializers.ReadOnlyField()
    project_name     = serializers.CharField(source='project.name', read_only=True)

    class Meta:
        model  = Timeline
        fields = [
            'id', 'project', 'project_name', 'name', 'description',
            'start_date', 'end_date', 'status', 'progress', 'color',
            'order', 'assignees', 'assignee_details', 'milestones',
            'duration_days', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, attrs):
        start = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end   = attrs.get('end_date',   getattr(self.instance, 'end_date',   None))
        if start and end and start > end:
            raise serializers.ValidationError({'end_date': 'End date must be after start date.'})
        return attrs
