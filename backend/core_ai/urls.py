from django.urls import path
from .views import upload_dataset, get_analysis_status, delete_analysis, list_user_analyses, get_public_analysis, browse_public_datasets

urlpatterns = [
    path('api/upload/', upload_dataset, name='upload'),
    path('api/analysis/<int:analysis_id>/', get_analysis_status, name='analysis_status'),
    path('analysis/<int:analysis_id>/status/', get_analysis_status, name='get_analysis_status'),
    path('analysis/<uuid:analysis_id>/delete/', delete_analysis, name='delete_analysis'),
    
    # User's analyses
    path('my-analyses/', list_user_analyses, name='list_user_analyses'),
    
    # Public access (for decentralized browsing)
    path('public/<str:analysis_cid>/', get_public_analysis, name='get_public_analysis'),
    path('browse/', browse_public_datasets, name='browse_public_datasets'),
    
    # Platform statistics
]