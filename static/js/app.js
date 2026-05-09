const app = angular.module('ecommerceApp', []);

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
        if (type === 'login') {
            $scope.isLoginOpen = !$scope.isLoginOpen;
            $scope.isRegisterOpen = false;
        } else {
            $scope.isRegisterOpen = !$scope.isRegisterOpen;
            $scope.isLoginOpen = false;
        }
    };

    $scope.seedData = function() {
        const initialProducts = [
            {
                name: "MistJet Pro Series",
                description: "Full brass body with matte black finish. High-pressure precision jet.",
                price: "1850",
                image_url: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=800"
            },
            {
                name: "MistJet Chrome Classic",
                description: "Triple-plated chrome finish. Ergonomic grip and anti-clog nozzle.",
                price: "1250",
                image_url: "https://images.unsplash.com/photo-1620626011761-9963d7521576?auto=format&fit=crop&q=80&w=800"
            },
            {
                name: "Ultra-Flow Handheld",
                description: "Flexible 1.5m stainless steel hose. Dual-mode adjustable spray.",
                price: "2450",
                image_url: "https://images.unsplash.com/photo-1584622781564-1d9876a13d00?auto=format&fit=crop&q=80&w=800"
            },
            {
                name: "Aetheria Gold Edition",
                description: "Luxury 24k gold-plated finish. Designed for premium designer bathrooms.",
                price: "5500",
                image_url: "https://images.unsplash.com/photo-1604709177595-ee9c2580e9a3?auto=format&fit=crop&q=80&w=800"
            },
            {
                name: "MistJet Compact Mini",
                description: "Space-saving design with powerful performance. Ideal for modern apartments.",
                price: "950",
                image_url: "https://images.unsplash.com/photo-1595856902263-d3f3f5a11634?auto=format&fit=crop&q=80&w=800"
            }
        ];

        $scope.products = initialProducts;
        
        $http.post('/api/seed/', { products: initialProducts })
            .then(function(response) {
                console.log("Database synchronized with MistJet sanitaryware collection");
            });
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

    $scope.processCheckout = function() {
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
                $scope.shippingData = { fullName: '', email: '', address: '', city: '', zipCode: '' };
            }, function(error) {
                $scope.showNotification(error.data.error || "Checkout failed");
            });
    };

    $scope.getTotal = function() {
        return $scope.cart.reduce(function(sum, item) { return sum + parseFloat(item.price); }, 0).toFixed(2);
    };

    // Admin Logic
    $scope.isAdminOpen = false;
    $scope.adminTab = 'orders';
    $scope.adminOrders = [];
    $scope.isEditProductOpen = false;
    $scope.editingProduct = {};

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
            });
    };

    $scope.editProduct = function(product) {
        $scope.editingProduct = angular.copy(product);
        // Convert price from string to number for input[type=number]
        if ($scope.editingProduct.price) {
            $scope.editingProduct.price = parseFloat($scope.editingProduct.price);      
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
