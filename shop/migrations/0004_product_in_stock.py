from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0003_rename_total_amount_order_total_price_order_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='in_stock',
            field=models.BooleanField(default=True),
        ),
    ]
