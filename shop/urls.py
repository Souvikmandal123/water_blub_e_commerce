from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('mistjet-admin/', views.admin_dashboard, name='admin_dashboard'),
    path('api/products/', views.product_list, name='product_list'),
    path('api/seed/', views.seed_data, name='seed_data'),
    path('api/register/', views.register_user, name='register'),
    path('api/login/', views.login_user, name='login'),
    path('api/logout/', views.logout_user, name='logout'),
    path('api/user/', views.get_current_user, name='get_user'),
    path('api/checkout/', views.checkout, name='checkout'),
    path('api/orders/', views.get_user_orders, name='user_orders'),
    
    # Admin API
    path('api/admin/orders/', views.admin_get_all_orders, name='admin_orders'),
    path('api/admin/orders/<int:order_id>/status/', views.admin_update_order_status, name='admin_update_status'),
    path('api/admin/products/', views.admin_manage_product, name='admin_products'),
    path('api/admin/products/<int:product_id>/', views.admin_delete_product, name='admin_delete_product'),
    path('api/admin/products/<int:product_id>/stock/', views.admin_toggle_stock, name='admin_toggle_stock'),
    path('api/admin/upload/', views.admin_upload_image, name='admin_upload'),
    path('api/revolut/create-order/', views.create_revolut_order, name='create_revolut_order'),
]
