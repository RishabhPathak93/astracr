"""projects/serializers.py"""
import os
from rest_framework import serializers
from django.conf import settings
from .models import Project, ProjectUpdate, ProjectDocument
from accounts.serializers import UserSerializer
from clients.serializers import ClientSerializer


class ProjectUpdateSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.name', read_only=True)

    class Meta:
        model  = ProjectUpdate
        fields = ['id', 'project', 'author', 'author_name', 'content', 'created_at']
        read_only_fields = ['id', 'author', 'created_at']


class ProjectDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.name', read_only=True)
    file_url         = serializers.SerializerMethodField()

    class Meta:
        model  = ProjectDocument
        fields = ['id', 'project', 'uploaded_by', 'uploaded_by_name', 'name', 'file', 'file_url', 'file_size', 'uploaded_at']
        read_only_fields = ['id', 'uploaded_by', 'file_size', 'uploaded_at']
        extra_kwargs = {'file': {'write_only': True}}

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and hasattr(obj.file, 'url') and request:
            return request.build_absolute_uri(obj.file.url)
        return None

    def validate_file(self, value):
        ext = os.path.splitext(value.name)[1].lower()
        allowed = settings.ALLOWED_IMAGE_EXTENSIONS + settings.ALLOWED_DOCUMENT_EXTENSIONS
        if ext not in allowed:
            raise serializers.ValidationError(f'File type "{ext}" is not allowed.')
        if value.size > settings.MAX_DOCUMENT_SIZE_MB * 1024 * 1024:
            raise serializers.ValidationError(f'File must be under {settings.MAX_DOCUMENT_SIZE_MB} MB.')
        return value


class ProjectListSerializer(serializers.ModelSerializer):
    client_name        = serializers.CharField(source='client.name', read_only=True)
    manager_name       = serializers.CharField(source='manager.name', read_only=True)
    resource_count     = serializers.IntegerField(source='resources.count', read_only=True)
    budget_utilization = serializers.ReadOnlyField()

    class Meta:
        model  = Project
        fields = [
            'id', 'name', 'status', 'priority', 'progress',
            'start_date', 'end_date', 'budget', 'spent',
            'client_name', 'manager_name', 'resource_count',
            'budget_utilization', 'tags', 'created_at',
        ]


class ProjectDetailSerializer(serializers.ModelSerializer):
    client_detail    = ClientSerializer(source='client', read_only=True)
    manager_detail   = UserSerializer(source='manager', read_only=True)
    resource_details = UserSerializer(source='resources', many=True, read_only=True)
    updates          = ProjectUpdateSerializer(many=True, read_only=True)
    documents        = ProjectDocumentSerializer(many=True, read_only=True)
    budget_utilization = serializers.ReadOnlyField()
    is_over_budget   = serializers.ReadOnlyField()

    class Meta:
        model  = Project
        fields = [
            'id', 'name', 'description', 'client', 'client_detail',
            'manager', 'manager_detail', 'resources', 'resource_details',
            'start_date', 'end_date', 'budget', 'spent',
            'status', 'priority', 'progress', 'tags',
            'budget_utilization', 'is_over_budget',
            'created_by', 'created_at', 'updated_at',
            'updates', 'documents',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def validate(self, attrs):
        start = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end   = attrs.get('end_date',   getattr(self.instance, 'end_date',   None))
        if start and end and start > end:
            raise serializers.ValidationError({'end_date': 'End date must be after start date.'})
        return attrs
