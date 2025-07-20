// Global state
let currentMovieId = null;
let selectedRating = 0;
let currentUser = 1;

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎬 Professional Movie Recommender with TMDb API Initialized');
    initializeApp();
});

function initializeApp() {
    setupEventListeners();
    setupScrollEffects();
    loadDiscoverContent();
}

function setupEventListeners() {
    // Navigation
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const section = this.dataset.section;
            showSection(section, this);
        });
    });

    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }

    // Star ratings
    const stars = document.querySelectorAll('.star');
    stars.forEach(star => {
        star.addEventListener('click', function() {
            const rating = parseInt(this.dataset.rating);
            selectRating(rating);
        });
    });

    // Modal close on escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal();
            closeRatingModal();
        }
    });
}

function setupScrollEffects() {
    window.addEventListener('scroll', function() {
        const header = document.querySelector('.header');
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
}

// Section navigation
function showSection(sectionName, buttonElement) {
    // Hide all sections
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => section.classList.remove('active'));
    
    // Hide hero
    const hero = document.getElementById('hero');
    if (sectionName !== 'discover') {
        hero.style.display = 'none';
    } else {
        hero.style.display = 'block';
    }
    
    // Remove active class from all nav buttons
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => btn.classList.remove('active'));
    
    // Show selected section
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Activate clicked button
    if (buttonElement) {
        buttonElement.classList.add('active');
    }
    
    // Load section content
    switch(sectionName) {
        case 'discover':
            loadDiscoverContent();
            break;
        case 'search':
            performSearch('');
            break;
        case 'recommendations':
            loadRecommendations('content');
            break;
    }
}

// Load discover content (trending and popular movies)
async function loadDiscoverContent() {
    await Promise.all([
        loadTrendingMovies(),
        loadPopularMovies()
    ]);
}

async function loadTrendingMovies() {
    try {
        const response = await fetch('/api/trending');
        if (!response.ok) throw new Error('Failed to fetch trending movies');
        
        const movies = await response.json();
        displayMovieRow(movies.slice(0, 10), 'trendingMovies');
    } catch (error) {
        console.error('Error loading trending movies:', error);
        showEmptyState('trendingMovies', 'Error Loading Trending Movies', 'Please try again later.');
    }
}

async function loadPopularMovies() {
    try {
        const response = await fetch('/api/popular');
        if (!response.ok) throw new Error('Failed to fetch popular movies');
        
        const movies = await response.json();
        displayMovieRow(movies.slice(0, 10), 'popularMovies');
    } catch (error) {
        console.error('Error loading popular movies:', error);
        showEmptyState('popularMovies', 'Error Loading Popular Movies', 'Please try again later.');
    }
}

// Display movies in horizontal row format
function displayMovieRow(movies, containerId) {
    const container = document.getElementById(containerId);
    if (!container || !movies.length) return;
    
    const moviesHTML = movies.map(movie => `
        <div class="movie-card" onclick="openMovieModal(${movie.id})">
            <div class="movie-poster">
                <img src="${movie.thumbnail || 'https://via.placeholder.com/280x420/333/fff?text=' + encodeURIComponent(movie.title)}" 
                     alt="${escapeHtml(movie.title)}"
                     onerror="this.src='https://via.placeholder.com/280x420/333/fff?text=' + encodeURIComponent('${movie.title}')"
                     loading="lazy">
            </div>
            <div class="movie-info">
                <div class="movie-title">${escapeHtml(movie.title)}</div>
                <div class="movie-meta">
                    <span>${movie.year}</span>
                    <span class="rating-badge">★ ${movie.rating}</span>
                </div>
                <div class="genres">
                    ${(movie.genres || []).slice(0, 2).map(genre => `<span class="genre-tag">${genre}</span>`).join('')}
                </div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = moviesHTML;
}

// Search functionality
async function performSearch(query = null) {
    const searchInput = document.getElementById('searchInput');
    const statusElement = document.getElementById('searchStatus');
    const resultsElement = document.getElementById('searchResults');
    
    if (query === null && searchInput) {
        query = searchInput.value.trim();
    }
    
    try {
        updateStatus('searchStatus', `🔍 Searching ${query ? `for "${query}"` : 'popular movies'}...`, 'loading');
        
        const response = await fetch(`/api/search?q=${encodeURIComponent(query || '')}`);
        if (!response.ok) throw new Error('Search failed');
        
        const movies = await response.json();
        
        displayMovieGrid(movies, 'searchResults');
        
        if (movies.length > 0) {
            updateStatus('searchStatus', `✅ Found ${movies.length} movie${movies.length === 1 ? '' : 's'}`, 'success');
        } else {
            updateStatus('searchStatus', `❌ No movies found${query ? ` for "${query}"` : ''}`, 'error');
        }
        
    } catch (error) {
        console.error('Search error:', error);
        updateStatus('searchStatus', '❌ Search failed. Please try again.', 'error');
        showEmptyState('searchResults', 'Search Error', 'Unable to search movies right now.');
    }
}

// Load recommendations
async function loadRecommendations(type = 'content', buttonElement = null) {
    const statusElement = document.getElementById('recommendationStatus');
    const resultsElement = document.getElementById('recommendationResults');
    
    // Update active filter
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => btn.classList.remove('active'));
    if (buttonElement) {
        buttonElement.classList.add('active');
    }
    
    try {
        updateStatus('recommendationStatus', '🎯 Loading personalized recommendations...', 'loading');
        
        let endpoint = '/api/recommendations';
        if (type === 'popular') {
            endpoint = '/api/popular';
        } else if (type === 'trending') {
            endpoint = '/api/trending';
        }
        
        const response = await fetch(`${endpoint}?userId=${currentUser}&type=${type}`);
        if (!response.ok) throw new Error('Recommendations failed');
        
        const movies = await response.json();
        
        displayMovieGrid(movies, 'recommendationResults');
        
        if (movies.length > 0) {
            updateStatus('recommendationStatus', `✅ Generated ${movies.length} recommendations`, 'success');
        } else {
            updateStatus('recommendationStatus', '❌ No recommendations available', 'error');
            showEmptyState('recommendationResults', 'No Recommendations', 'Rate some movies to get personalized suggestions.');
        }
        
    } catch (error) {
        console.error('Recommendations error:', error);
        updateStatus('recommendationStatus', '❌ Failed to load recommendations', 'error');
        showEmptyState('recommendationResults', 'Error', 'Unable to load recommendations right now.');
    }
}

// Display movies in grid format
function displayMovieGrid(movies, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (!movies || movies.length === 0) {
        showEmptyState(containerId, 'No Movies Found', 'Try different search terms or check back later.');
        return;
    }
    
    const moviesHTML = movies.map(movie => {
        const genres = (movie.genres || []).slice(0, 3).map(genre => 
            `<span class="genre-tag">${genre}</span>`
        ).join('');
        
        return `
            <div class="movie-card" onclick="openMovieModal(${movie.id})">
                <div class="movie-poster">
                    <img src="${movie.thumbnail || 'https://via.placeholder.com/280x420/333/fff?text=' + encodeURIComponent(movie.title)}" 
                         alt="${escapeHtml(movie.title)}"
                         onerror="this.src='https://via.placeholder.com/280x420/333/fff?text=' + encodeURIComponent('${movie.title}')"
                         loading="lazy">
                </div>
                <div class="movie-info">
                    <h3 class="movie-title">${escapeHtml(movie.title)}</h3>
                    <div class="movie-meta">
                        <span>${movie.year}</span>
                        <span class="rating-badge">★ ${movie.rating}</span>
                        ${movie.duration ? `<span>${movie.duration}</span>` : ''}
                    </div>
                    <div class="genres">${genres}</div>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = moviesHTML;
}

// Movie modal with detailed information
async function openMovieModal(movieId) {
    try {
        const response = await fetch(`/api/movie/${movieId}`);
        if (!response.ok) throw new Error('Failed to fetch movie details');
        
        const movie = await response.json();
        
        currentMovieId = movieId;
        
        // Populate modal with detailed movie information
        document.getElementById('modalImage').src = movie.thumbnail || 'https://via.placeholder.com/200x300/333/fff?text=' + encodeURIComponent(movie.title);
        document.getElementById('modalTitle').textContent = movie.title;
        document.getElementById('modalYear').textContent = movie.year;
        document.getElementById('modalRating').textContent = `★ ${movie.rating}`;
        document.getElementById('modalDuration').textContent = movie.duration || '';
        document.getElementById('modalDescription').textContent = movie.description || 'No description available.';
        
        // Populate genres
        const genresContainer = document.getElementById('modalGenres');
        genresContainer.innerHTML = (movie.genres || []).map(genre => 
            `<span class="genre-tag">${genre}</span>`
        ).join('');
        
        // Populate cast information
        const castContainer = document.getElementById('modalCast');
        if (movie.actors && movie.actors.length > 0) {
            castContainer.innerHTML = `
                <h4>Cast</h4>
                <p>${movie.actors.join(', ')}</p>
            `;
        } else {
            castContainer.innerHTML = '';
        }
        
        // Show modal
        const modal = document.getElementById('movieModal');
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
    } catch (error) {
        console.error('Error opening movie modal:', error);
        alert('Error loading movie details. Please try again.');
    }
}

function closeModal() {
    const modal = document.getElementById('movieModal');
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
}

// Rating modal functionality
function openRatingModal() {
    if (!currentMovieId) return;
    
    const modal = document.getElementById('ratingModal');
    modal.classList.add('active');
    
    selectedRating = 0;
    updateStarDisplay();
}

function closeRatingModal() {
    const modal = document.getElementById('ratingModal');
    modal.classList.remove('active');
    selectedRating = 0;
}

function selectRating(rating) {
    selectedRating = rating;
    updateStarDisplay();
}

function updateStarDisplay() {
    const stars = document.querySelectorAll('.star');
    stars.forEach((star, index) => {
        if (index < selectedRating) {
            star.classList.add('selected');
        } else {
            star.classList.remove('selected');
        }
    });
}

async function submitRating() {
    if (selectedRating === 0) {
        alert('Please select a rating!');
        return;
    }
    
    try {
        const response = await fetch('/api/rate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser,
                movieId: currentMovieId,
                rating: selectedRating
            })
        });
        
        if (!response.ok) throw new Error('Rating failed');
        
        alert(`✅ Successfully rated with ${selectedRating} stars!`);
        closeRatingModal();
        closeModal();
        
        // Refresh recommendations if on that section
        const activeSection = document.querySelector('.section.active');
        if (activeSection && activeSection.id === 'recommendations') {
            const activeFilter = document.querySelector('.filter-btn.active');
            loadRecommendations('content', activeFilter);
        }
        
    } catch (error) {
        console.error('Rating error:', error);
        alert('❌ Error submitting rating. Please try again.');
    }
}

// Utility functions
function updateStatus(elementId, message, type = '') {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.className = `status ${type}`;
    }
}

function showEmptyState(containerId, title, message) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>${title}</h3>
                <p>${message}</p>
            </div>
        `;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
