from django.shortcuts import render
from django.http import JsonResponse
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
import json
import requests
from .models import Product, Order, OrderItem

# Administrative Decorator
def admin_required(func):
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated or not request.user.is_staff:
            return JsonResponse({"error": "Administrative access required"}, status=403)
        return func(request, *args, **kwargs)
    return wrapper

def index(request):
    """Serves the AngularJS application."""
    return render(request, 'index.html')

@admin_required
def admin_dashboard(request):
    """Serves the dedicated Admin Dashboard."""
    return render(request, 'admin.html')

def product_list(request):
    """API endpoint to list all products."""
    products = Product.objects.all()
    return JsonResponse([p.to_dict() for p in products], safe=False)

@csrf_exempt
def seed_data(request):
    """Populates the database with initial The Bum Gun products."""
    products_to_seed = []
    
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            products_to_seed = data.get('products', [])
        except:
            pass
            
    if not products_to_seed:
        products_to_seed = [
            {
                "name": "The Bum Gun Pro Series",
                "description": "Full brass body with matte black finish. High-pressure precision jet.",
                "price": 1850.00,
                "original_price": 2450.00,
                "image_url": "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=800"
            },
            {
                "name": "The Bum Gun Chrome Classic",
                "description": "Triple-plated chrome finish. Ergonomic grip and anti-clog nozzle.",
                "price": 1250.00,
                "original_price": 1750.00,
                "image_url": "https://images.unsplash.com/photo-1728975728593-b128b77fa813?auto=format&fit=crop&q=80&w=800"
            },
            {
                "name": "The Bum Gun Ultra-Flow",
                "description": "Flexible 1.5m stainless steel hose. Dual-mode adjustable spray.",
                "price": 2450.00,
                "image_url": "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&q=80&w=800"
            },
            {
                "name": "The Bum Gun Gold Edition",
                "description": "Luxury 24k gold-plated finish. Designed for premium designer bathrooms.",
                "price": 5500.00,
                "image_url": "https://images.unsplash.com/photo-1604709177595-ee9c2580e9a3?auto=format&fit=crop&q=80&w=800"
            },
            {
                "name": "The Bum Gun Compact Mini",
                "description": "Space-saving design with powerful performance. Ideal for modern apartments.",
                "price": 950.00,
                "image_url": "https://images.unsplash.com/photo-1595856902263-d3f3f5a11634?auto=format&fit=crop&q=80&w=800"
            }
        ]

    # Clear existing to avoid duplicates if desired, or just create
    Product.objects.all().delete()
    
    for p in products_to_seed:
        Product.objects.create(**p)
    
    return JsonResponse({"message": "Ecosystem synchronized with The Bum Gun collection"})

@csrf_exempt
def register_user(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        username = data.get('username')
        password = data.get('password')
        email = data.get('email')
        
        if User.objects.filter(username=username).exists():
            return JsonResponse({"error": "Username already exists"}, status=400)
        
        user = User.objects.create_user(username=username, password=password, email=email)
        login(request, user)
        return JsonResponse({"message": "User registered successfully", "user": {"username": user.username}})
    return JsonResponse({"error": "Invalid request method"}, status=405)

@csrf_exempt
def login_user(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        username = data.get('username')
        password = data.get('password')
        
        user = authenticate(request, username=username, password=password)
        if user is not None:
            login(request, user)
            return JsonResponse({"message": "Login successful", "user": {"username": user.username, "is_staff": user.is_staff}})
        else:
            return JsonResponse({"error": "Invalid credentials"}, status=401)
    return JsonResponse({"error": "Invalid request method"}, status=405)

def logout_user(request):
    logout(request)
    return JsonResponse({"message": "Logout successful"})

def get_current_user(request):
    if request.user.is_authenticated:
        return JsonResponse({
            "user": {
                "username": request.user.username,
                "is_staff": request.user.is_staff
            }
        })
    return JsonResponse({"user": None})

def get_user_orders(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)
    
    orders = Order.objects.filter(user=request.user).order_by('-created_at')
    order_data = []
    for order in orders:
        items = [{
            "product": item.product.name,
            "quantity": item.quantity,
            "price": str(item.price)
        } for item in order.items.all()]
        
        order_data.append({
            "id": order.id,
            "total": str(order.total_price),
            "date": order.created_at.strftime("%Y-%m-%d %H:%M"),
            "items": items,
            "status": order.get_status_display()
        })
    return JsonResponse(order_data, safe=False)

@csrf_exempt
def checkout(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            shipping = data.get('shipping')
            cart_items = data.get('cart')
            
            if not cart_items:
                return JsonResponse({"error": "Cart is empty"}, status=400)
            
            # Calculate total
            total = sum(float(item['price']) for item in cart_items)
            
            # Create Order
            order = Order.objects.create(
                user=request.user if request.user.is_authenticated else None,
                full_name=shipping.get('fullName'),
                email=shipping.get('email'),
                address=shipping.get('address'),
                city=shipping.get('city'),
                zip_code=shipping.get('zipCode'),
                total_price=total,
                status='PENDING'
            )
            
            # Create Order Items
            for item in cart_items:
                product = Product.objects.get(id=item['id'])
                OrderItem.objects.create(
                    order=order,
                    product=product,
                    price=item['price'],
                    quantity=1 # Simplified
                )
            
            return JsonResponse({
                "message": "Order placed successfully", 
                "order_id": order.id
            }, status=201)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"error": "Invalid request method"}, status=405)

# Administrative Endpoints (Staff Only)

@admin_required
def admin_get_all_orders(request):
    orders = Order.objects.all().order_by('-created_at')
    order_data = []
    for order in orders:
        items = [{
            "product": item.product.name,
            "quantity": item.quantity,
            "price": str(item.price)
        } for item in order.items.all()]
        
        order_data.append({
            "id": order.id,
            "user": order.user.username if order.user else "Guest",
            "total": str(order.total_price),
            "date": order.created_at.strftime("%Y-%m-%d %H:%M"),
            "items": items,
            "status": order.status,
            "status_display": order.get_status_display(),
            "customer_info": {
                "name": order.full_name,
                "email": order.email,
                "address": f"{order.address}, {order.city} ({order.zip_code})"
            }
        })
    return JsonResponse(order_data, safe=False)

@csrf_exempt
@admin_required
def admin_update_order_status(request, order_id):
    if request.method == 'POST':
        data = json.loads(request.body)
        new_status = data.get('status')
        try:
            order = Order.objects.get(id=order_id)
            order.status = new_status
            order.save()
            return JsonResponse({"message": f"Order #{order_id} updated to {order.get_status_display()}"})
        except Order.DoesNotExist:
            return JsonResponse({"error": "Order not found"}, status=404)
    return JsonResponse({"error": "Invalid request method"}, status=405)

@csrf_exempt
@admin_required
def admin_manage_product(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        product_id = data.get('id')
        if product_id:
            product = Product.objects.get(id=product_id)
            product.name = data.get('name', product.name)
            product.description = data.get('description', product.description)
            product.price = data.get('price', product.price)
            product.original_price = data.get('original_price', product.original_price)
            ship_fee = data.get('shipping_fee')
            if ship_fee is not None and ship_fee != '':
                product.shipping_fee = ship_fee
            product.image_url = data.get('image_url', product.image_url)
            product.badge_text = data.get('badge_text', product.badge_text)
            if 'in_stock' in data:
                product.in_stock = data['in_stock']
            product.save()
            return JsonResponse({"message": "Product updated"})
        else:
            # Enforce 6 product limit
            if Product.objects.count() >= 6:
                return JsonResponse({"error": "Product limit reached. Maximum 6 products allowed."}, status=400)
            Product.objects.create(
                name=data.get('name'),
                description=data.get('description'),
                price=data.get('price'),
                original_price=data.get('original_price'),
                shipping_fee=data.get('shipping_fee') if data.get('shipping_fee') else 0.00,
                image_url=data.get('image_url'),
                badge_text=data.get('badge_text') if data.get('badge_text') else "Curated"
            )
            return JsonResponse({"message": "Product created"}, status=201)
    return JsonResponse({"error": "Invalid request method"}, status=405)

@csrf_exempt
@admin_required
def admin_delete_product(request, product_id):
    if request.method == 'DELETE':
        try:
            Product.objects.get(id=product_id).delete()
            return JsonResponse({"message": "Product deleted"})
        except Product.DoesNotExist:
            return JsonResponse({"error": "Product not found"}, status=404)
    return JsonResponse({"error": "Invalid request method"}, status=405)

@csrf_exempt
@admin_required
def admin_toggle_stock(request, product_id):
    if request.method == 'POST':
        try:
            product = Product.objects.get(id=product_id)
            product.in_stock = not product.in_stock
            product.save()
            status = "In Stock" if product.in_stock else "Out of Stock"
            return JsonResponse({"message": f"{product.name} marked as {status}", "in_stock": product.in_stock})
        except Product.DoesNotExist:
            return JsonResponse({"error": "Product not found"}, status=404)
    return JsonResponse({"error": "Invalid request method"}, status=405)

@csrf_exempt
@admin_required
def admin_upload_image(request):
    if request.method == 'POST' and request.FILES.get('image'):
        image = request.FILES['image']
        from django.conf import settings
        import os, time

        if not os.path.exists(settings.MEDIA_ROOT):
            os.makedirs(settings.MEDIA_ROOT)
        
        # Add timestamp to prevent collisions
        ext = os.path.splitext(image.name)[1]
        safe_name = image.name.replace(' ', '_')
        file_name = f"{int(time.time())}_{safe_name}"
        file_path = os.path.join(settings.MEDIA_ROOT, file_name)
        with open(file_path, 'wb+') as destination:
            for chunk in image.chunks():
                destination.write(chunk)
        
        return JsonResponse({
            "message": "Image uploaded",
            "url": f"/media/{file_name}"
        })
    return JsonResponse({"error": "No image uploaded"}, status=400)

@csrf_exempt
def create_revolut_order(request):
    """
    Creates a local order first, then creates a Revolut order linked to it.
    """
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            cart = data.get('cart', [])
            shipping = data.get('shipping')
            
            if not cart or not shipping:
                return JsonResponse({"error": "Cart or shipping info missing"}, status=400)
            
            # 1. Calculate total and validate products
            total_pounds = 0
            for item in cart:
                try:
                    product = Product.objects.get(id=item['id'])
                    total_pounds += float(product.price)
                    if product.shipping_fee:
                        total_pounds += float(product.shipping_fee)
                except Product.DoesNotExist:
                    return JsonResponse({"error": f"Product {item.get('name')} not found"}, status=404)
            
            # 2. Create Local Order (PENDING)
            order = Order.objects.create(
                user=request.user if request.user.is_authenticated else None,
                full_name=shipping.get('fullName'),
                email=shipping.get('email'),
                address=shipping.get('address'),
                city=shipping.get('city'),
                zip_code=shipping.get('zipCode'),
                total_price=total_pounds,
                status='PENDING'
            )
            
            for item in cart:
                product = Product.objects.get(id=item['id'])
                OrderItem.objects.create(
                    order=order,
                    product=product,
                    price=product.price,
                    quantity=1
                )

            # 3. Create Revolut Order
            amount_cents = int(total_pounds * 100)
            payload = {
                "amount": amount_cents,
                "currency": "GBP",
                "capture_mode": "AUTOMATIC",
                "merchant_order_ext_ref": str(order.id), # Link to our order ID
                "metadata": {
                    "local_order_id": str(order.id)
                }
            }
            
            headers = {
                "Authorization": f"Bearer {settings.REVOLUT_SECRET_KEY}",
                "Content-Type": "application/json",
                "Revolut-Api-Version": settings.REVOLUT_API_VERSION
            }
            
            response = requests.post(settings.REVOLUT_API_URL, json=payload, headers=headers)
            
            if response.status_code == 201:
                revolut_data = response.json()
                # Store Revolut Order ID in our DB
                order.revolut_order_id = revolut_data.get("id")
                order.save()
                
                return JsonResponse({
                    "public_id": revolut_data.get("public_id"),
                    "local_order_id": order.id
                })
            else:
                # If Revolut fails, we might want to delete the local order or keep it as failed
                order.status = 'CANCELLED'
                order.save()
                return JsonResponse({
                    "error": "Failed to create Revolut order",
                    "details": response.text
                }, status=response.status_code)
                
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
            
    return JsonResponse({"error": "Invalid method"}, status=405)

@csrf_exempt
def revolut_webhook(request):
    """
    Handles payment notifications from Revolut.
    """
    if request.method == 'POST':
        # Optional: Verify signature here if settings.REVOLUT_WEBHOOK_SECRET is set
        try:
            data = json.loads(request.body)
            event = data.get('event')
            
            # Revolut sends order data in the 'order' field or directly in payload depending on event
            order_data = data.get('order') or data
            revolut_order_id = order_data.get('id')
            
            if event == 'ORDER_COMPLETED' or data.get('status') == 'COMPLETED':
                try:
                    order = Order.objects.get(revolut_order_id=revolut_order_id)
                    if order.status == 'PENDING':
                        order.status = 'PROCESSING'
                        order.save()
                        print(f"Order {order.id} marked as PROCESSING via Webhook")
                except Order.DoesNotExist:
                    print(f"Webhook received for unknown Revolut Order: {revolut_order_id}")
            
            return JsonResponse({"status": "received"})
        except Exception as e:
            print(f"Webhook Error: {str(e)}")
            return JsonResponse({"error": "Invalid payload"}, status=400)
            
    return JsonResponse({"error": "Invalid method"}, status=405)

