const app = angular.module('ecommerceApp', ['ngSanitize']);

// Directive: handles file input change and calls the scope callback
app.directive('fileSelect', function() {
    return {
        restrict: 'A',
        scope: false,
        link: function(scope, element, attrs) {
            element.on('change', function(e) {
                var file = e.target.files && e.target.files[0];
                if (file) {
                    scope.$apply(function() {
                        scope[attrs.fileSelect](file);
                    });
                }
                // Reset so the same file can be re-selected
                element[0].value = '';
            });
        }
    };
});

app.controller('ProductController', ['$scope', '$http', '$timeout', function($scope, $http, $timeout) {
    $scope.products = [];
    $scope.cart = [];
    $scope.user = null;
    $scope.isCartOpen = false;
    $scope.isCheckingOut = false;
    $scope.isSuccess = false;
    $scope.isOrdersOpen = false;
    $scope.lastOrderId = null;
    $scope.orders = [];
    $scope.showToast = false;
    $scope.toastMessage = "";
    
    // Auth modals
    $scope.isLoginOpen = false;
    $scope.isRegisterOpen = false;
    $scope.authData = { username: '', password: '', email: '' };
    $scope.shippingData = { fullName: '', email: '', address: '', city: '', zipCode: '' };
    $scope.orderFilter = 'ALL';

    // Fetch products and user from Django API
    $scope.init = function() {
        // Fetch products
        $http.get('/api/products/')
            .then(function(response) {
                $scope.products = response.data;
                if ($scope.products.length === 0) {
                    $scope.seedData();
                }
            });

        // Check if user is logged in
        $http.get('/api/user/')
            .then(function(response) {
                $scope.user = response.data.user;
            });
    };

    $scope.login = function() {
        $http.post('/api/login/', $scope.authData)
            .then(function(response) {
                $scope.user = response.data.user;
                $scope.isLoginOpen = false;
                $scope.authData = { username: '', password: '', email: '' };
                $scope.showNotification("Login Successful: " + $scope.user.username);
                $scope.fetchOrders();
            }, function(error) {
                $scope.showNotification(error.data.error || "Login Failed");
            });
    };

    $scope.register = function() {
        $http.post('/api/register/', $scope.authData)
            .then(function(response) {
                $scope.user = response.data.user;
                $scope.isRegisterOpen = false;
                $scope.authData = { username: '', password: '', email: '' };
                $scope.showNotification("Account Created. Welcome, " + $scope.user.username);
                $scope.fetchOrders();
            }, function(error) {
                $scope.showNotification(error.data.error || "Registration Failed");
            });
    };

    $scope.logout = function() {
        $http.get('/api/logout/')
            .then(function() {
                $scope.user = null;
                $scope.showNotification("Logged out successfully.");
            });
    };

    $scope.toggleAuth = function(type) {
        if (!type) {
            $scope.isLoginOpen = false;
            $scope.isRegisterOpen = false;
        } else if (type === 'login') {
            $scope.isLoginOpen = !$scope.isLoginOpen;
            $scope.isRegisterOpen = false;
        } else if (type === 'register') {
            $scope.isRegisterOpen = !$scope.isRegisterOpen;
            $scope.isLoginOpen = false;
        }
    };

    $scope.seedData = function() {
        const initialProducts = [
            {
                name: "The Bum Gun Pro Series",
                description: "Full brass body with matte black finish. High-pressure precision jet.",
                price: "1850",
                original_price: "2450",
                image_url: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=800"
            },
            {
                name: "The Bum Gun Chrome Classic",
                description: "Triple-plated chrome finish. Ergonomic grip and anti-clog nozzle.",
                price: "1250",
                original_price: "1750",
                image_url: "https://images.unsplash.com/photo-1728975728593-b128b77fa813?auto=format&fit=crop&q=80&w=800"
            },
            {
                name: "The Bum Gun Ultra-Flow",
                description: "Flexible 1.5m stainless steel hose. Dual-mode adjustable spray.",
                price: "2450",
                image_url: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&q=80&w=800"
            },
            {
                name: "The Bum Gun Gold Edition",
                description: "Luxury 24k gold-plated finish. Designed for premium designer bathrooms.",
                price: "5500",
                image_url: "https://images.unsplash.com/photo-1604709177595-ee9c2580e9a3?auto=format&fit=crop&q=80&w=800"
            },
            {
                name: "The Bum Gun Compact Mini",
                description: "Space-saving design with powerful performance. Ideal for modern apartments.",
                price: "950",
                image_url: "https://images.unsplash.com/photo-1595856902263-d3f3f5a11634?auto=format&fit=crop&q=80&w=800"
            }
        ];

        $scope.products = initialProducts;
        
        $http.post('/api/seed/', { products: initialProducts })
            .then(function(response) {
                console.log("Database synchronized with The Bum Gun sanitaryware collection");
            });
    };

    $scope.scrollToProducts = function() {
        const element = document.getElementById('collection-start');
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };
    
    $scope.addToCart = function(product) {
        if (!product.in_stock) {
            $scope.showNotification(product.name + ' is out of stock.');
            return;
        }
        $scope.cart.push(angular.copy(product));
        $scope.showNotification(product.name + ' added to collection!');
    };

    $scope.removeFromCart = function(index) {
        $scope.cart.splice(index, 1);
        if ($scope.cart.length === 0) {
            $scope.isCheckingOut = false;
        }
    };

    $scope.toggleCart = function() {
        $scope.isCartOpen = !$scope.isCartOpen;
        if (!$scope.isCartOpen) {
            $scope.isCheckingOut = false;
            $scope.isSuccess = false;
        }
    };

    $scope.toggleOrders = function() {
        $scope.isOrdersOpen = !$scope.isOrdersOpen;
        if ($scope.isOrdersOpen) {
            $scope.fetchOrders();
        }
    };

    $scope.fetchOrders = function() {
        $http.get('/api/orders/')
            .then(function(response) {
                $scope.orders = response.data;
            }, function(error) {
                console.error("Error fetching orders:", error);
            });
    };

    $scope.startCheckout = function() {
        if ($scope.cart.length === 0) return;
        
        if (!$scope.user) {
            $scope.showNotification("Please login to proceed with checkout.");
            $scope.toggleAuth('login');
            $scope.isCartOpen = false;
            return;
        }
        
        $scope.isCheckingOut = true;
    };

    $scope.isPaymentProcessing = false;

    $scope.processCheckout = function() {
        // Step 1: Create Revolut Order on backend
        $scope.isPaymentProcessing = true;
        
        const amount = $scope.getTotal();
        $http.post('/api/revolut/create-order/', { amount: amount })
            .then(function(response) {
                const public_id = response.data.public_id;
                
                // Step 2: Initialize Revolut Checkout
                RevolutCheckout(public_id, 'sandbox').then(function(instance) {
                    instance.payWithPopup({
                        onSuccess() {
                            $scope.$apply(function() {
                                $scope.submitOrder();
                                $scope.isPaymentProcessing = false;
                            });
                        },
                        onError(error) {
                            $scope.$apply(function() {
                                $scope.showNotification("Payment failed: " + error.message);
                                $scope.isPaymentProcessing = false;
                            });
                        },
                        onCancel() {
                            $scope.$apply(function() {
                                $scope.isPaymentProcessing = false;
                            });
                        }
                    });
                });
            }, function(error) {
                $scope.isPaymentProcessing = false;
                const errorMsg = error.data.error || "Failed to initiate Revolut payment";
                $scope.showNotification(errorMsg);
                console.error("Revolut Error:", error.data);
            });
    };

    $scope.submitOrder = function() {
        const payload = {
            cart: $scope.cart,
            shipping: $scope.shippingData
        };

        $http.post('/api/checkout/', payload)
            .then(function(response) {
                $scope.showNotification("Order #" + response.data.order_id + " placed successfully!");
                $scope.cart = [];
                $scope.isSuccess = true;
                $scope.lastOrderId = response.data.order_id;
                $scope.isCheckingOut = false;
                $scope.isCartOpen = true; // Ensure they see the success message
                $scope.shippingData = { fullName: '', email: '', address: '', city: '', zipCode: '' };
            }, function(error) {
                $scope.showNotification(error.data.error || "Checkout failed");
            });
    };

    $scope.getSub = function() {
        let subtotal = 0;
        if (!$scope.cart) return "0.00";
        $scope.cart.forEach(function(item) {
            subtotal += (parseFloat(item.price || 0) * (item.quantity || 1));
        });
        return subtotal.toFixed(2);
    };

    $scope.getShip = function() {
        let shipping = parseFloat(($scope.storeSettings && $scope.storeSettings.delivery_charge) || 0);
        if ($scope.cart) {
            $scope.cart.forEach(function(item) {
                shipping += (parseFloat(item.shipping_fee || 0) * (item.quantity || 1));
            });
        }
        return shipping.toFixed(2);
    };

    $scope.getTotal = function() {
        const sub = parseFloat($scope.getSub());
        const ship = parseFloat($scope.getShip());
        return (sub + ship).toFixed(2);
    };

    // Admin Logic
    $scope.isAdminOpen = false;
    $scope.adminTab = 'orders';
    $scope.adminOrders = [];
    $scope.isEditProductOpen = false;
    $scope.editingProduct = {};
    $scope.isInfoOpen = false;
    $scope.infoType = '';

    $scope.infoContent = {
        installation: {
            title: 'Installation Guide',
            content: 'Installing your MistJet elite spray is a straightforward 5-minute process. <br><br>1. Turn off the water supply.<br>2. Unscrew your existing hose/head.<br>3. Attach the MistJet universal connector with the provided rubber washers.<br>4. Tighten firmly but do not over-torque.<br>5. Turn on water and check for leaks.<br><br><a href="https://www.youtube.com/watch?v=6OSDKHiwZm8" target="_blank" class="checkout-btn" style="display: block; text-align: center; margin-top: 1.5rem; text-decoration: none;">Watch Video Tutorial</a>'
        },
        shipping: {
            title: 'Shipping Policy',
            content: 'We offer worldwide complimentary express shipping on all MistJet orders. <br><br>• Domestic (India): 2-4 business days.<br>• International: 5-8 business days.<br>• Tracking: You will receive a tracking ID via email once your order is dispatched.<br>• Packaging: All products are shipped in our signature premium protective case.'
        },
        warranty: {
            title: 'Elite Warranty',
            content: 'MistJet stands behind the quality of its engineering. <br><br>• 2-Year Full Coverage: Protection against any manufacturing defects.<br>• Premium Support: 24/7 access to our concierge support team for any technical issues.<br>• Hassle-Free Replacement: If your product fails under normal use, we will ship a replacement free of charge.'
        },
        contact: {
            title: 'Contact Us',
            content: 'Our concierge team is available 24/7 to assist with your inquiries.<br><br><b>📞 Mobile:</b> +91 98765 43210<br><b>✉️ Email:</b> concierge@mistjet.com<br><b>📍 Address:</b> 12th Floor, Skyview Towers, Hitech City, Hyderabad, India - 500081'
        }
    };

    $scope.openInfo = function(type) {
        $scope.infoType = type;
        $scope.isInfoOpen = true;
    };

    $scope.toggleAdminDashboard = function() {
        if (!$scope.user || !$scope.user.is_staff) return;
        $scope.isAdminOpen = !$scope.isAdminOpen;
        if ($scope.isAdminOpen) $scope.fetchAdminOrders();
    };

    $scope.setAdminTab = function(tab) {
        $scope.adminTab = tab;
    };

    $scope.fetchAdminOrders = function() {
        $http.get('/api/admin/orders/')
            .then(function(response) {
                $scope.adminOrders = response.data;
            });
    };

    $scope.updateOrderStatus = function(order) {
        $http.post('/api/admin/orders/' + order.id + '/status/', { status: order.status })
            .then(function(response) {
                $scope.showNotification(response.data.message);
                // Optionally refetch user orders if they are open to stay in sync
                if ($scope.isOrdersOpen) $scope.fetchOrders();
            });
    };

    $scope.toggleOrderDetails = function(order) {
        order.isExpanded = !order.isExpanded;
    };

    $scope.editProduct = function(product) {
        $scope.editingProduct = angular.copy(product);
        // Convert price from string to number for input[type=number]
        if ($scope.editingProduct.price) {
            $scope.editingProduct.price = parseFloat($scope.editingProduct.price);      
        }
        if ($scope.editingProduct.original_price) {
            $scope.editingProduct.original_price = parseFloat($scope.editingProduct.original_price);      
        }
        if ($scope.editingProduct.shipping_fee) {
            $scope.editingProduct.shipping_fee = parseFloat($scope.editingProduct.shipping_fee);      
        }
        $scope.selectedImageFile = null;
        $scope.imagePreviewUrl = null;
        $scope.selectedFileName = null;
        $scope.isUploading = false;
        $scope.isEditProductOpen = true;
    };

    // Handle image file selection
    $scope.onImageSelected = function(file) {
        if (!file) return;

        // Validate size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            $scope.showNotification("Image too large. Max 5MB allowed.");
            return;
        }

        $scope.selectedImageFile = file;
        $scope.selectedFileName = file.name;
        $scope.showNotification("Image selected: " + file.name);

        // Create local preview
        var reader = new FileReader();
        reader.onload = function(e) {
            $timeout(function() {
                $scope.imagePreviewUrl = e.target.result;
            });
        };
        reader.onerror = function() {
            $timeout(function() {
                $scope.showNotification("Failed to read image file.");
            });
        };
        reader.readAsDataURL(file);
    };

    // Save product (uploads image first if one was selected)
    $scope.saveProduct = function() {
        var doSave = function(imageUrl) {
            var payload = {
                name: $scope.editingProduct.name,
                description: $scope.editingProduct.description,
                price: $scope.editingProduct.price,
                original_price: $scope.editingProduct.original_price,
                shipping_fee: $scope.editingProduct.shipping_fee,
                image_url: imageUrl || $scope.editingProduct.image_url || ''
            };
            if ($scope.editingProduct.id) {
                payload.id = $scope.editingProduct.id;
            }
            $http.post('/api/admin/products/', payload)
                .then(function(response) {
                    $scope.showNotification(response.data.message);
                    $scope.isEditProductOpen = false;
                    $scope.selectedImageFile = null;
                    $scope.imagePreviewUrl = null;
                    $scope.init();
                }, function(error) {
                    $scope.showNotification(error.data.error || "Save failed");
                });
        };

        if ($scope.selectedImageFile) {
            $scope.isUploading = true;
            var fd = new FormData();
            fd.append("image", $scope.selectedImageFile);

            $http.post('/api/admin/upload/', fd, {
                transformRequest: angular.identity,
                headers: {'Content-Type': undefined}
            }).then(function(response) {
                $scope.isUploading = false;
                doSave(response.data.url);
            }, function(error) {
                $scope.isUploading = false;
                $scope.showNotification("Image upload failed. Please try again.");
            });
        } else {
            doSave();
        }
    };

    $scope.deleteProduct = function(id) {
        if (confirm("Are you sure you want to delete this product?")) {
            $http.delete('/api/admin/products/' + id + '/')
                .then(function(response) {
                    $scope.showNotification(response.data.message);
                    $scope.init();
                });
        }
    };

    $scope.toggleStock = function(product) {
        $http.post('/api/admin/products/' + product.id + '/stock/')
            .then(function(response) {
                product.in_stock = response.data.in_stock;
                $scope.showNotification(response.data.message);
            }, function(error) {
                $scope.showNotification(error.data.error || 'Failed to update stock');
            });
    };

    $scope.initAdmin = function() {
        $http.get('/api/user/')
            .then(function(response) {
                $scope.user = response.data.user;
                if ($scope.user && $scope.user.is_staff) {
                    $scope.fetchAdminOrders();
                    $scope.init();
                }
            });
    };

    $scope.showNotification = function(msg) {
        $scope.toastMessage = msg;
        $scope.showToast = true;
        $timeout(function() {
            $scope.showToast = false;
        }, 3000);
    };

    // Initial load
    $scope.init();
}]);
