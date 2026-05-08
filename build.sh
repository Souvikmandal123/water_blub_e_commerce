#!/usr/bin/env bash
# exit on error
set -o errexit

pip install -r requirements.txt

python manage.py collectstatic --no-input
python manage.py migrate

# Seed initial product data
python manage.py shell -c "
from shop.models import Product
if Product.objects.count() == 0:
    Product.objects.bulk_create([
        Product(name='MistJet Pro Series', description='Full brass body with matte black finish. High-pressure precision jet.', price=1850.00, image_url='https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=800'),
        Product(name='MistJet Chrome Classic', description='Triple-plated chrome finish. Ergonomic grip and anti-clog nozzle.', price=1250.00, image_url='https://images.unsplash.com/photo-1620626011761-9963d7521576?auto=format&fit=crop&q=80&w=800'),
        Product(name='Ultra-Flow Handheld', description='Flexible 1.5m stainless steel hose. Dual-mode adjustable spray.', price=2450.00, image_url='https://images.unsplash.com/photo-1584622781564-1d9876a13d00?auto=format&fit=crop&q=80&w=800'),
    ])
    print('Seeded 3 products.')
else:
    print('Products already exist, skipping seed.')
"

# Create admin superuser
python manage.py shell -c "
from django.contrib.auth.models import User
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin')
    print('Created admin superuser.')
else:
    print('Admin user already exists, skipping.')
"
