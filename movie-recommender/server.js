const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// TMDb API configuration
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = process.env.TMDB_BASE_URL;
const TMDB_IMAGE_BASE_URL = process.env.TMDB_IMAGE_BASE_URL;

// User ratings storage (in-memory for demo)
let users = [{ id: 1, name: "Demo User", ratings: {} }];

// Helper function to format movie data from TMDb
function formatMovieData(tmdbMovie) {
    return {
        id: tmdbMovie.id,
        title: tmdbMovie.title,
        year: new Date(tmdbMovie.release_date).getFullYear(),
        rating: parseFloat(tmdbMovie.vote_average.toFixed(1)),
        description: tmdbMovie.overview,
        thumbnail: tmdbMovie.poster_path ? `${TMDB_IMAGE_BASE_URL}${tmdbMovie.poster_path}` : null,
        backdrop: tmdbMovie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${tmdbMovie.backdrop_path}` : null,
        popularity: tmdbMovie.popularity,
        duration: tmdbMovie.runtime ? `${tmdbMovie.runtime} min` : 'N/A',
        genres: []
    };
}

// Get genre mapping from TMDb
async function getGenres() {
    try {
        const response = await axios.get(`${TMDB_BASE_URL}/genre/movie/list`, {
            params: {
                api_key: TMDB_API_KEY,
                language: 'en-US'
            }
        });
        
        const genreMap = {};
        response.data.genres.forEach(genre => {
            genreMap[genre.id] = genre.name;
        });
        
        return genreMap;
    } catch (error) {
        console.error('Error fetching genres:', error);
        return {};
    }
}

// Map genre IDs to names
async function mapGenresToNames(movies) {
    const genreMap = await getGenres();
    
    return movies.map(movie => {
        if (movie.genre_ids && Array.isArray(movie.genre_ids)) {
            movie.genres = movie.genre_ids.map(genreId => genreMap[genreId] || 'Unknown');
        }
        return movie;
    });
}

// API Routes

// Get popular movies
app.get('/api/popular', async (req, res) => {
    try {
        const response = await axios.get(`${TMDB_BASE_URL}/movie/popular`, {
            params: {
                api_key: TMDB_API_KEY,
                language: 'en-US',
                page: 1
            }
        });

        let movies = response.data.results.map(movie => {
            const formatted = formatMovieData(movie);
            formatted.genre_ids = movie.genre_ids;
            return formatted;
        });
        
        movies = await mapGenresToNames(movies);
        
        console.log(`📊 Fetched ${movies.length} popular movies from TMDb`);
        res.json(movies);
    } catch (error) {
        console.error('❌ Error fetching popular movies:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch popular movies' });
    }
});

// Get trending movies
app.get('/api/trending', async (req, res) => {
    try {
        const response = await axios.get(`${TMDB_BASE_URL}/trending/movie/day`, {
            params: {
                api_key: TMDB_API_KEY,
                language: 'en-US'
            }
        });

        let movies = response.data.results.map(movie => {
            const formatted = formatMovieData(movie);
            formatted.genre_ids = movie.genre_ids;
            return formatted;
        });
        
        movies = await mapGenresToNames(movies);
        
        console.log(`📊 Fetched ${movies.length} trending movies from TMDb`);
        res.json(movies);
    } catch (error) {
        console.error('❌ Error fetching trending movies:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch trending movies' });
    }
});

// Search movies
app.get('/api/search', async (req, res) => {
    try {
        const { q } = req.query;
        console.log(`🔍 Searching for: "${q}"`);

        if (!q || q.trim() === '') {
            // Return popular movies if no search query
            const response = await axios.get(`${TMDB_BASE_URL}/movie/popular`, {
                params: {
                    api_key: TMDB_API_KEY,
                    language: 'en-US',
                    page: 1
                }
            });

            let movies = response.data.results.map(movie => {
                const formatted = formatMovieData(movie);
                formatted.genre_ids = movie.genre_ids;
                return formatted;
            });
            
            movies = await mapGenresToNames(movies);
            return res.json(movies);
        }

        const response = await axios.get(`${TMDB_BASE_URL}/search/movie`, {
            params: {
                api_key: TMDB_API_KEY,
                language: 'en-US',
                query: q,
                page: 1,
                include_adult: false
            }
        });

        let movies = response.data.results
            .filter(movie => movie.poster_path)
            .map(movie => {
                const formatted = formatMovieData(movie);
                formatted.genre_ids = movie.genre_ids;
                return formatted;
            });
        
        movies = await mapGenresToNames(movies);
        
        console.log(`📊 Found ${movies.length} movies for "${q}"`);
        res.json(movies);
    } catch (error) {
        console.error('❌ Search error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Search failed' });
    }
});

// Get movie details
app.get('/api/movie/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const [movieResponse, creditsResponse] = await Promise.all([
            axios.get(`${TMDB_BASE_URL}/movie/${id}`, {
                params: {
                    api_key: TMDB_API_KEY,
                    language: 'en-US'
                }
            }),
            axios.get(`${TMDB_BASE_URL}/movie/${id}/credits`, {
                params: {
                    api_key: TMDB_API_KEY,
                    language: 'en-US'
                }
            })
        ]);

        const movie = movieResponse.data;
        const credits = creditsResponse.data;
        
        const formattedMovie = {
            id: movie.id,
            title: movie.title,
            year: new Date(movie.release_date).getFullYear(),
            rating: parseFloat(movie.vote_average.toFixed(1)),
            genres: movie.genres.map(g => g.name),
            description: movie.overview,
            thumbnail: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}` : null,
            backdrop: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
            duration: movie.runtime ? `${movie.runtime} min` : 'N/A',
            director: credits.crew?.find(person => person.job === 'Director')?.name || 'Unknown',
            actors: credits.cast?.slice(0, 5).map(actor => actor.name) || [],
            budget: movie.budget,
            revenue: movie.revenue
        };

        res.json(formattedMovie);
    } catch (error) {
        console.error('❌ Error fetching movie details:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch movie details' });
    }
});

// Get recommendations
app.get('/api/recommendations', async (req, res) => {
    try {
        const { userId = 1, type = 'content' } = req.query;
        
        const response = await axios.get(`${TMDB_BASE_URL}/movie/top_rated`, {
            params: {
                api_key: TMDB_API_KEY,
                language: 'en-US',
                page: 1
            }
        });

        let movies = response.data.results
            .slice(0, 12)
            .map(movie => {
                const formatted = formatMovieData(movie);
                formatted.genre_ids = movie.genre_ids;
                return formatted;
            });
        
        movies = await mapGenresToNames(movies);
        
        console.log(`🎯 Generated ${movies.length} recommendations for user ${userId}`);
        res.json(movies);
    } catch (error) {
        console.error('❌ Recommendations error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to generate recommendations' });
    }
});

// Rate a movie
app.post('/api/rate', (req, res) => {
    try {
        const { userId, movieId, rating } = req.body;
        
        let user = users.find(u => u.id === userId);
        if (!user) {
            user = { id: userId, name: `User ${userId}`, ratings: {} };
            users.push(user);
        }
        
        user.ratings[movieId] = rating;
        console.log(`⭐ User ${userId} rated movie ${movieId} with ${rating} stars`);
        
        res.json({ success: true, message: 'Rating saved successfully' });
    } catch (error) {
        console.error('❌ Rating error:', error);
        res.status(500).json({ error: 'Failed to save rating' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        tmdb_connected: !!TMDB_API_KEY,
        timestamp: new Date().toISOString()
    });
});

// Test endpoint
app.get('/api/test', async (req, res) => {
    try {
        const response = await axios.get(`${TMDB_BASE_URL}/movie/popular`, {
            params: {
                api_key: TMDB_API_KEY,
                language: 'en-US',
                page: 1
            }
        });
        
        res.json({ 
            success: true, 
            message: 'TMDb API connected successfully!',
            movies_count: response.data.results.length 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'TMDb API connection failed',
            error: error.message 
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Netflix-Style Movie Recommender running at http://localhost:${PORT}`);
    console.log(`🔑 TMDb API Key: ${TMDB_API_KEY ? 'Configured ✅' : 'Missing ❌'}`);
    
    if (!TMDB_API_KEY) {
        console.log('⚠️  Please add your TMDb API key to the .env file');
    }
});
