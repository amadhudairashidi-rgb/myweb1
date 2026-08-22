(function() {
    // ===== CONFIGURATION =====
    const API_BASE = '/api';
    const CACHE_KEY = 'bluehouse_cache';

    // ===== STATE =====
    let allProducts = [];
    let categories = [];
    let posts = [];
    let currentCategory = 'all';
    let wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    let searchQuery = '';
    let isSearchActive = false;

    // ===== DOM REFS =====
    const hamburger = document.getElementById('hamburgerBtn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const closeSidebar = document.getElementById('closeSidebar');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const cartCountSpan = document.getElementById('cartCount');
    const wishlistCountSpan = document.getElementById('wishlistCount');
    const goHomeBtn = document.getElementById('goHomeBtn');
    const searchToggleBtn = document.getElementById('searchToggleBtn');
    const searchBarContainer = document.getElementById('searchBarContainer');
    const searchInput = document.getElementById('searchInput');
    const searchCloseBtn = document.getElementById('searchCloseBtn');

    const views = {
        home: document.getElementById('home-view'),
        cart: document.getElementById('cart-view'),
        wishlist: document.getElementById('wishlist-view'),
        info: document.getElementById('info-view')
    };

    function updateCounts() {
        cartCountSpan.textContent = cart.length;
        wishlistCountSpan.textContent = wishlist.length;
    }
    updateCounts();

    // ===== API HELPERS =====
    async function apiRequest(endpoint, method = 'GET', body = null) {
        const options = {
            method: method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (body) options.body = JSON.stringify(body);
        const response = await fetch(`${API_BASE}/${endpoint}`, options);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        return await response.json();
    }

    async function fetchData(endpoint) {
        try { return await apiRequest(endpoint); } catch (e) { console.warn('API fetch error:', e); return null; }
    }

    async function postData(endpoint, data) {
        try { return await apiRequest(endpoint, 'POST', data); } catch (e) { console.error('Error posting:', e); }
    }

    async function putData(endpoint, data) {
        try { return await apiRequest(endpoint, 'PUT', data); } catch (e) { console.error('Error putting:', e); }
    }

    async function deleteData(endpoint) {
        try { return await apiRequest(endpoint, 'DELETE'); } catch (e) { console.error('Error deleting:', e); }
    }

    // ===== CACHE =====
    function loadFromCache() {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const data = JSON.parse(cached);
                if (data && data.products && data.categories && data.posts) {
                    allProducts = data.products;
                    categories = data.categories;
                    posts = data.posts;
                    return true;
                }
            }
        } catch (e) { console.warn('Cache read error', e); }
        return false;
    }

    function saveToCache() {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                products: allProducts,
                categories: categories,
                posts: posts,
                timestamp: Date.now()
            }));
        } catch (e) { console.warn('Cache write error', e); }
    }

    // ===== LOAD DATA =====
    async function loadData(force = false) {
        if (!force && loadFromCache()) {
            renderCategoryButtons();
            filterAndRenderProducts();
            refreshBackground();
            return;
        }

        showSkeleton();
        const [catsData, prodsData, postsData] = await Promise.all([
            fetchData('categories'),
            fetchData('products'),
            fetchData('posts')
        ]);

        categories = catsData ? Object.entries(catsData).map(([id, value]) => ({ id, ...value })) : [];
        allProducts = prodsData ? Object.entries(prodsData).map(([id, value]) => ({ id, ...value })) : [];
        posts = postsData ? Object.entries(postsData).map(([id, value]) => ({ id, ...value })) : [];
        posts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        saveToCache();
        renderCategoryButtons();
        filterAndRenderProducts();
    }

    async function refreshBackground() {
        try {
            const [catsData, prodsData, postsData] = await Promise.all([
                fetchData('categories'),
                fetchData('products'),
                fetchData('posts')
            ]);
            let newCats = catsData ? Object.entries(catsData).map(([id, value]) => ({ id, ...value })) : [];
            let newProds = prodsData ? Object.entries(prodsData).map(([id, value]) => ({ id, ...value })) : [];
            let newPosts = postsData ? Object.entries(postsData).map(([id, value]) => ({ id, ...value })) : [];
            newPosts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            let changed = false;
            if (JSON.stringify(categories) !== JSON.stringify(newCats)) { categories = newCats; changed = true; }
            if (JSON.stringify(allProducts) !== JSON.stringify(newProds)) { allProducts = newProds; changed = true; }
            if (JSON.stringify(posts) !== JSON.stringify(newPosts)) { posts = newPosts; changed = true; }

            if (changed) {
                saveToCache();
                renderCategoryButtons();
                filterAndRenderProducts();
            }
        } catch (e) { console.warn('Background refresh error', e); }
    }

    function showSkeleton() {
        document.getElementById('productGrid').innerHTML =
            '<div class="loading-skeleton">' + '<div class="skeleton-card"></div>'.repeat(6) + '</div>';
    }

    // ===== RENDER CATEGORY BUTTONS =====
    function renderCategoryButtons() {
        const bar = document.getElementById('categoryBar');
        bar.innerHTML = '<button class="category-btn active" data-category="all">All Products</button>';
        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'category-btn';
            btn.dataset.category = cat.id;
            btn.textContent = cat.name;
            bar.appendChild(btn);
        });
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentCategory = btn.dataset.category;
                document.getElementById('categoryTitle').innerText = currentCategory === 'all' ?
                    'All Products & Posts' :
                    (categories.find(c => c.id === currentCategory)?.name || 'Products');
                searchInput.value = '';
                searchQuery = '';
                isSearchActive = false;
                searchBarContainer.style.display = 'none';
                filterAndRenderProducts();
            });
        });
    }

    // ===== FORMAT DATE =====
    function formatDateEn(timestamp) {
        if (!timestamp) return '';
        const d = new Date(timestamp);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
    }

    // ===== HIGHLIGHT SEARCH =====
    function highlightText(text, query) {
        if (!query || !text) return text;
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<span class="search-highlight">$1</span>');
    }

    // ===== FILTER & RENDER PRODUCTS =====
    function filterAndRenderProducts() {
        let filteredProducts = currentCategory === 'all' ?
            allProducts :
            allProducts.filter(p => p.categoryId === currentCategory);

        if (isSearchActive && searchQuery) {
            filteredProducts = filteredProducts.filter(p =>
                p.name?.toLowerCase().includes(searchQuery) ||
                p.description?.toLowerCase().includes(searchQuery)
            );
        }

        let combined = [];
        if (currentCategory === 'all') {
            let filteredPosts = posts;
            if (isSearchActive && searchQuery) {
                filteredPosts = posts.filter(p =>
                    p.text?.toLowerCase().includes(searchQuery)
                );
            }
            const postsWithFlag = filteredPosts.map(p => ({ ...p, _isPost: true }));
            combined = [...filteredProducts, ...postsWithFlag];
            combined.sort((a, b) => {
                const dateA = a.timestamp ? new Date(a.timestamp) : new Date(0);
                const dateB = b.timestamp ? new Date(b.timestamp) : new Date(0);
                return dateB - dateA;
            });
        } else {
            combined = filteredProducts;
        }

        const grid = document.getElementById('productGrid');
        const noProducts = document.getElementById('noProducts');

        if (combined.length === 0) {
            noProducts.style.display = 'block';
            grid.innerHTML = '';
            return;
        }
        noProducts.style.display = 'none';
        grid.innerHTML = '';

        combined.forEach(item => {
            if (item._isPost) {
                // POST CARD
                const card = document.createElement('div');
                card.className = 'post-card';
                let imageHtml = '';
                if (item.image && item.image.trim() !== '') {
                    imageHtml =
                        `<div class="post-image"><img src="${item.image}" alt="Post" onerror="this.src='https://via.placeholder.com/400x320?text=Error'"></div>`;
                } else {
                    imageHtml = `<div class="post-image no-image"></div>`;
                }
                let textHtml = '';
                if (item.text && item.text.trim() !== '') {
                    const highlightedText = isSearchActive ? highlightText(item.text, searchQuery) : item.text;
                    textHtml = `<div class="post-text">${highlightedText}</div>`;
                }
                const dateStr = formatDateEn(item.timestamp);
                card.innerHTML = `
                            ${imageHtml}
                            <div class="post-content">
                                <span class="post-badge"><i class="fas fa-newspaper"></i> Post</span>
                                ${textHtml}
                                ${dateStr ? `<span class="post-date"><i class="far fa-clock"></i> ${dateStr}</span>` : ''}
                            </div>
                        `;
                grid.appendChild(card);
            } else {
                // PRODUCT CARD
                const prod = item;
                const cat = categories.find(c => c.id === prod.categoryId);
                const catName = cat ? cat.name : 'Uncategorized';
                const isWishlisted = wishlist.includes(prod.id);
                const showOverlay = prod.textOverlay === true && prod.description && prod.description.trim() !==
                '';

                const discountPercent = parseFloat(prod.discountPercent) || 0;
                const hasDiscount = discountPercent > 0;
                const originalPrice = prod.price || 0;
                const discountedPrice = hasDiscount ? originalPrice - (originalPrice * discountPercent / 100) :
                    originalPrice;

                const card = document.createElement('div');
                card.className = 'product-card';

                let imgHtml = `
                            <div class="product-image">
                                <img src="${prod.image || 'https://via.placeholder.com/400x320?text=No+Image'}"
                                     alt="${prod.name}"
                                     onerror="this.src='https://via.placeholder.com/400x320?text=Error'">
                                ${showOverlay ? `<div class="image-overlay-text show">${prod.description}</div>` : ''}
                            </div>
                        `;

                let descHtml = '';
                if (!showOverlay && prod.description && prod.description.trim() !== '') {
                    const highlightedDesc = isSearchActive ? highlightText(prod.description, searchQuery) : prod
                        .description;
                    descHtml = `<div class="product-description">${highlightedDesc}</div>`;
                }

                let priceHtml = '';
                if (hasDiscount) {
                    priceHtml = `
                                <div class="product-price-wrapper">
                                    <span class="product-price old-price">${originalPrice.toLocaleString()} somon</span>
                                    <span class="product-price">${discountedPrice.toLocaleString()} somon</span>
                                    <span class="discount-badge">-${discountPercent}%</span>
                                </div>
                            `;
                } else {
                    priceHtml = `
                                <div class="product-price-wrapper">
                                    <span class="product-price normal">${originalPrice.toLocaleString()} somon</span>
                                </div>
                            `;
                }

                const highlightedName = isSearchActive ? highlightText(prod.name, searchQuery) : prod.name;

                card.innerHTML = `
                            ${imgHtml}
                            <div class="product-info">
                                <div class="product-name">${highlightedName}</div>
                                ${priceHtml}
                                <span class="product-category-badge">${catName}</span>
                                ${descHtml}
                                <div class="product-actions">
                                    <button class="add-to-cart" data-id="${prod.id}"><i class="fas fa-cart-plus"></i> Add</button>
                                    <button class="wishlist-btn ${isWishlisted ? 'active' : ''}" data-id="${prod.id}"><i class="fas fa-heart"></i></button>
                                </div>
                            </div>
                        `;
                grid.appendChild(card);
            }
        });

        document.querySelectorAll('.add-to-cart').forEach(btn => {
            btn.addEventListener('click', (e) => { e.stopPropagation();
                addToCart(btn.dataset.id); });
        });
        document.querySelectorAll('.wishlist-btn').forEach(btn => {
            btn.addEventListener('click', (e) => { e.stopPropagation();
                toggleWishlist(btn.dataset.id, btn); });
        });
    }

    // ===== CART / WISHLIST FUNCTIONS =====
    function addToCart(productId) {
        const product = allProducts.find(p => p.id === productId);
        if (!product) return;
        const existing = cart.find(item => item.id === productId);
        if (existing) existing.quantity += 1;
        else {
            const discountPercent = parseFloat(product.discountPercent) || 0;
            const finalPrice = discountPercent > 0 ? product.price - (product.price * discountPercent / 100) :
                product.price;
            cart.push({ ...product, quantity: 1, price: finalPrice });
        }
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCounts();
        alert('Added to cart!');
    }

    function toggleWishlist(productId, btn) {
        if (wishlist.includes(productId)) {
            wishlist = wishlist.filter(id => id !== productId);
            btn?.classList.remove('active');
        } else {
            wishlist.push(productId);
            btn?.classList.add('active');
        }
        localStorage.setItem('wishlist', JSON.stringify(wishlist));
        updateCounts();
    }

    function renderCartView() {
        const container = document.getElementById('cartItemsContainer');
        const totalSpan = document.getElementById('cartTotal');
        const checkoutDiv = document.getElementById('checkoutForm');

        if (!cart.length) {
            container.innerHTML =
                '<div class="empty-state"><i class="fas fa-shopping-basket"></i>Your cart is empty.</div>';
            totalSpan.innerHTML = '';
            checkoutDiv.style.display = 'none';
            return;
        }

        let html = '';
        let total = 0;
        cart.forEach(item => {
            const itemTotal = (item.price || 0) * item.quantity;
            total += itemTotal;
            html += `
                        <div class="list-item" data-id="${item.id}">
                            <img src="${item.image || 'https://via.placeholder.com/80'}" alt="${item.name}">
                            <div class="item-details">
                                <div class="item-name">${item.name}</div>
                                <div class="item-price">${item.price?.toLocaleString()} somon</div>
                                <div class="item-quantity">
                                    <button class="quantity-btn" data-id="${item.id}" data-change="-1">-</button>
                                    <span>${item.quantity}</span>
                                    <button class="quantity-btn" data-id="${item.id}" data-change="1">+</button>
                                    <button class="remove-btn" data-id="${item.id}">Remove</button>
                                </div>
                            </div>
                        </div>
                    `;
        });
        container.innerHTML = html;
        totalSpan.innerHTML = `Total: ${total.toLocaleString()} somon`;
        checkoutDiv.style.display = 'block';

        container.querySelectorAll('.quantity-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const change = parseInt(btn.dataset.change);
                const item = cart.find(i => i.id === id);
                if (item) {
                    item.quantity += change;
                    if (item.quantity <= 0) cart = cart.filter(i => i.id !== id);
                    localStorage.setItem('cart', JSON.stringify(cart));
                    updateCounts();
                    renderCartView();
                }
            });
        });
        container.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                cart = cart.filter(i => i.id !== btn.dataset.id);
                localStorage.setItem('cart', JSON.stringify(cart));
                updateCounts();
                renderCartView();
            });
        });
        document.getElementById('placeOrderBtn').onclick = placeOrder;
    }

    async function placeOrder() {
        const name = document.getElementById('customerName').value.trim();
        const phone = document.getElementById('customerPhone').value.trim();
        const address = document.getElementById('customerAddress').value.trim();
        if (!name || !phone || !address) {
            alert('Please fill in all fields.');
            return;
        }
        if (cart.length === 0) { alert('Your cart is empty.'); return; }

        const order = {
            customer: { name, phone, address },
            items: cart.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
            total: cart.reduce((sum, i) => sum + (i.price * i.quantity), 0),
            timestamp: new Date().toISOString(),
            completed: false
        };

        try {
            const result = await postData('orders', order);
            if (result) {
                alert('Order placed successfully!');
                cart = [];
                localStorage.setItem('cart', JSON.stringify(cart));
                updateCounts();
                showView('home');
            } else {
                alert('Failed to place order.');
            }
        } catch (e) {
            alert('Error placing order.');
        }
    }

    function renderWishlistView() {
        const container = document.getElementById('wishlistItemsContainer');
        const wishlistProducts = allProducts.filter(p => wishlist.includes(p.id));
        if (!wishlistProducts.length) {
            container.innerHTML =
                '<div class="empty-state"><i class="fas fa-heart"></i>Your wishlist is empty.</div>';
            return;
        }
        let html = '';
        wishlistProducts.forEach(prod => {
            const discountPercent = parseFloat(prod.discountPercent) || 0;
            const displayPrice = discountPercent > 0 ? prod.price - (prod.price * discountPercent / 100) :
                prod.price;
            html += `
                        <div class="list-item">
                            <img src="${prod.image || 'https://via.placeholder.com/80'}" alt="${prod.name}">
                            <div class="item-details">
                                <div class="item-name">${prod.name}</div>
                                <div class="item-price">${displayPrice.toLocaleString()} somon</div>
                                ${prod.description ? `<div style="font-size:0.9rem;opacity:0.7;">${prod.description}</div>` : ''}
                            </div>
                            <button class="add-to-cart-sm" data-id="${prod.id}"><i class="fas fa-cart-plus"></i> Add to Cart</button>
                            <button class="remove-btn" data-id="${prod.id}"><i class="fas fa-trash"></i> Remove</button>
                        </div>
                    `;
        });
        container.innerHTML = html;
        container.querySelectorAll('.add-to-cart-sm').forEach(btn => {
            btn.addEventListener('click', () => addToCart(btn.dataset.id));
        });
        container.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                wishlist = wishlist.filter(id => id !== btn.dataset.id);
                localStorage.setItem('wishlist', JSON.stringify(wishlist));
                updateCounts();
                renderWishlistView();
            });
        });
    }

    // ===== SIDEBAR / NAVIGATION =====
    function openSidebar() { sidebar.classList.add('active');
        overlay.classList.add('active'); }

    function closeSidebarFunc() { sidebar.classList.remove('active');
        overlay.classList.remove('active'); }
    hamburger.addEventListener('click', openSidebar);
    closeSidebar.addEventListener('click', closeSidebarFunc);
    overlay.addEventListener('click', closeSidebarFunc);

    darkModeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const icon = darkModeToggle.querySelector('i');
        if (document.body.classList.contains('dark-mode')) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
            darkModeToggle.innerHTML = '<i class="fas fa-sun"></i> Light Mode';
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
            darkModeToggle.innerHTML = '<i class="fas fa-moon"></i> Dark Mode';
        }
        closeSidebarFunc();
    });

    document.getElementById('contactLink').addEventListener('click', (e) => {
        e.preventDefault();
        showView('home');
        setTimeout(() => document.getElementById('mainFooter').scrollIntoView({ behavior: 'smooth' }), 100);
        closeSidebarFunc();
    });

    function showView(viewName) {
        Object.values(views).forEach(v => v.classList.remove('active-view'));
        views[viewName].classList.add('active-view');
        if (viewName === 'home') filterAndRenderProducts();
        else if (viewName === 'cart') renderCartView();
        else if (viewName === 'wishlist') renderWishlistView();
        closeSidebarFunc();
    }

    document.getElementById('cartViewLink').addEventListener('click', (e) => { e.preventDefault();
        showView('cart'); });
    document.getElementById('wishlistViewLink').addEventListener('click', (e) => { e.preventDefault();
        showView('wishlist'); });
    document.getElementById('infoViewLink').addEventListener('click', (e) => { e.preventDefault();
        showView('info'); });
    goHomeBtn.addEventListener('click', () => {
        searchBarContainer.style.display = 'none';
        searchInput.value = '';
        searchQuery = '';
        isSearchActive = false;
        showView('home');
    });
    document.getElementById('backToHomeFromCart').addEventListener('click', (e) => { e.preventDefault();
        showView('home'); });
    document.getElementById('backToHomeFromWishlist').addEventListener('click', (e) => { e.preventDefault();
        showView('home'); });
    document.getElementById('backToHomeFromInfo').addEventListener('click', (e) => { e.preventDefault();
        showView('home'); });
    document.getElementById('footerInfoLink').addEventListener('click', (e) => { e.preventDefault();
        showView('info'); });
    document.getElementById('footerContactLink').addEventListener('click', (e) => {
        e.preventDefault();
        showView('home');
        setTimeout(() => document.getElementById('mainFooter').scrollIntoView({ behavior: 'smooth' }), 100);
    });
    document.getElementById('footerHomeLink').addEventListener('click', (e) => { e.preventDefault();
        showView('home'); });

    // ===== SEARCH =====
    searchToggleBtn.addEventListener('click', () => {
        const isVisible = searchBarContainer.style.display !== 'none';
        if (isVisible) {
            searchBarContainer.style.display = 'none';
            searchInput.value = '';
            searchQuery = '';
            isSearchActive = false;
            filterAndRenderProducts();
        } else {
            searchBarContainer.style.display = 'block';
            searchInput.focus();
        }
    });

    searchCloseBtn.addEventListener('click', () => {
        searchBarContainer.style.display = 'none';
        searchInput.value = '';
        searchQuery = '';
        isSearchActive = false;
        filterAndRenderProducts();
    });

    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim().toLowerCase();
        isSearchActive = searchQuery.length > 0;
        filterAndRenderProducts();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && searchBarContainer.style.display !== 'none') {
            searchBarContainer.style.display = 'none';
            searchInput.value = '';
            searchQuery = '';
            isSearchActive = false;
            filterAndRenderProducts();
        }
    });

    // ===== INIT =====
    if (loadFromCache()) {
        renderCategoryButtons();
        filterAndRenderProducts();
        setTimeout(refreshBackground, 500);
    } else {
        loadData();
    }

    window.addEventListener('online', () => { loadData(true); });
    window.refreshStore = loadData;
})();