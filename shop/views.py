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
                "name": "Ultra-Flow Handheld",
                "description": "Flexible 1.5m stainless steel hose. Dual-mode adjustable spray.",
                "price": 2450.00,
                "image_url": "https://images.unsplash.com/photo-1620626011761-9963d7521576?auto=format&fit=crop&q=80&w=800"
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
                image_url=data.get('image_url')
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
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            amount = data.get('amount') # in pounds, e.g. 10.00
            
            # Revolut API expects amount in pence as an integer
            amount_cents = int(float(amount) * 100)
            
            payload = {
                "amount": amount_cents,
                "currency": "GBP",
                "capture_mode": "AUTOMATIC"
            }
            
            headers = {
                "Authorization": f"Bearer {settings.REVOLUT_SECRET_KEY}",
                "Content-Type": "application/json",
                "Revolut-Api-Version": settings.REVOLUT_API_VERSION
            }
            
            response = requests.post(settings.REVOLUT_API_URL, json=payload, headers=headers)
            
            if response.status_code == 201:
                revolut_data = response.json()
                # Revolut uses 'public_id' or 'token' depending on version. 
                # Let's return the whole thing or specifically public_id
                return JsonResponse({"public_id": revolut_data.get("public_id")})
            else:
                return JsonResponse({
                    "error": "Failed to create Revolut order",
                    "details": response.text
                }, status=response.status_code)
                
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
            
    return JsonResponse({"error": "Invalid method"}, status=405)

