"""timelines/urls.py"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

app_name = 'timelines'
router   = DefaultRouter()
router.register('milestones', views.MilestoneViewSet, basename='milestone')
router.register('',           views.TimelineViewSet,  basename='timeline')
urlpatterns = [path('', include(router.urls))]
