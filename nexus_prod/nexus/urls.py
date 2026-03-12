"""nexus/urls.py"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import (
    SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView
)

urlpatterns = [
    path('admin/',                admin.site.urls),
    path('api/v1/auth/',          include('accounts.urls',       namespace='accounts')),
    path('api/v1/clients/',       include('clients.urls',        namespace='clients')),
    path('api/v1/projects/',      include('projects.urls',       namespace='projects')),
    path('api/v1/timelines/',     include('timelines.urls',      namespace='timelines')),
    path('api/v1/resources/',     include('resources.urls',      namespace='resources')),
    path('api/v1/chat/',          include('chat.urls',           namespace='chat')),
    path('api/v1/notifications/', include('notifications.urls',  namespace='notifications')),
    # Schema — restricted to admin users in production
    path('api/schema/',  SpectacularAPIView.as_view(),          name='schema'),
    path('api/docs/',    SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/',   SpectacularRedocView.as_view(url_name='schema'),   name='redoc'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
