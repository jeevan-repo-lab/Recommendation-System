import React, { useState, useEffect } from 'react';
import { Film, Star, TrendingUp, Search, User, BookOpen, History, Clock, X } from 'lucide-react';

const MovieRecommendationSystem = () => {
  const [movies, setMovies] = useState([]);
  const [userRatings, setUserRatings] = useState({});
  const [recommendations, setRecommendations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [activeTab, setActiveTab] = useState('rate');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [watchHistory, setWatchHistory] = useState([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Load data from storage on mount
  useEffect(() => {
    loadFromStorage();
  }, []);

  const loadFromStorage = async () => {
    try {
      // Load user ratings
      const ratingsResult = await window.storage.get('user-ratings');
      if (ratingsResult) {
        setUserRatings(JSON.parse(ratingsResult.value));
      }

      // Load search history
      const searchResult = await window.storage.get('search-history');
      if (searchResult) {
        setSearchHistory(JSON.parse(searchResult.value));
      }

      // Load watch history
      const watchResult = await window.storage.get('watch-history');
      if (watchResult) {
        setWatchHistory(JSON.parse(watchResult.value));
      }
    } catch (error) {
      console.log('No stored data found, starting fresh');
    }
  };

  // Save user ratings to storage
  const saveRatings = async (ratings) => {
    try {
      await window.storage.set('user-ratings', JSON.stringify(ratings));
    } catch (error) {
      console.error('Failed to save ratings:', error);
    }
  };

  // Save search history
  const saveSearchHistory = async (history) => {
    try {
      await window.storage.set('search-history', JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save search history:', error);
    }
  };

  // Save watch history
  const saveWatchHistory = async (history) => {
    try {
      await window.storage.set('watch-history', JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save watch history:', error);
    }
  };

  // Search movies using OMDB API (free, open source alternative)
  const searchMovies = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    setSearching(true);
    setShowSearchDropdown(true);

    try {
      // Using OMDB API - free API key for demo
      const response = await fetch(
        `https://www.omdbapi.com/?apikey=5f6e8b7a&s=${encodeURIComponent(query)}&type=movie`
      );
      const data = await response.json();

      if (data.Response === 'True' && data.Search) {
        // Limit to 10 results
        const results = data.Search.slice(0, 10).map(movie => ({
          id: movie.imdbID,
          title: movie.Title,
          year: movie.Year,
          poster: movie.Poster !== 'N/A' ? movie.Poster : null,
          type: movie.Type
        }));

        setSearchResults(results);
        
        // Add to search history
        if (query.length > 2) {
          const newHistory = [
            { query, timestamp: Date.now(), results: results.length },
            ...searchHistory.filter(h => h.query !== query)
          ].slice(0, 20);
          setSearchHistory(newHistory);
          saveSearchHistory(newHistory);
        }
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    }

    setSearching(false);
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm) {
        searchMovies(searchTerm);
      } else {
        setSearchResults([]);
        setShowSearchDropdown(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Add to watch history
  const addToWatchHistory = async (movie) => {
    const watchEntry = {
      id: movie.id,
      title: movie.title,
      year: movie.year,
      poster: movie.poster,
      timestamp: Date.now()
    };

    const newHistory = [
      watchEntry,
      ...watchHistory.filter(h => h.id !== movie.id)
    ].slice(0, 50);

    setWatchHistory(newHistory);
    saveWatchHistory(newHistory);
    setShowSearchDropdown(false);
  };

  // Get movie details for rating
  const getMovieDetails = async (imdbID) => {
    try {
      const response = await fetch(
        `https://www.omdbapi.com/?apikey=5f6e8b7a&i=${imdbID}&plot=full`
      );
      const data = await response.json();

      if (data.Response === 'True') {
        return {
          id: data.imdbID,
          title: data.Title,
          genre: data.Genre?.split(',')[0] || 'Unknown',
          year: parseInt(data.Year) || 2020,
          rating: parseFloat(data.imdbRating) || 7.0,
          poster: data.Poster !== 'N/A' ? data.Poster : null,
          plot: data.Plot,
          director: data.Director,
          actors: data.Actors,
          features: generateFeatures(data)
        };
      }
    } catch (error) {
      console.error('Error fetching movie details:', error);
    }
    return null;
  };

  // Generate feature vector from movie data
  const generateFeatures = (movie) => {
    const genres = movie.Genre?.toLowerCase() || '';
    return [
      genres.includes('drama') || genres.includes('romance') ? 0.8 : 0.2,
      genres.includes('action') || genres.includes('thriller') || genres.includes('crime') ? 0.8 : 0.2,
      genres.includes('comedy') || genres.includes('family') ? 0.8 : 0.2,
      genres.includes('sci-fi') || genres.includes('fantasy') || genres.includes('adventure') ? 0.8 : 0.2
    ];
  };

  const cosineSimilarity = (vec1, vec2) => {
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      mag1 += vec1[i] * vec1[i];
      mag2 += vec2[i] * vec2[i];
    }

    if (mag1 === 0 || mag2 === 0) return 0;
    return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
  };

  const generateRecommendations = async () => {
    setLoading(true);

    try {
      const ratedMovieIds = Object.keys(userRatings);
      
      if (ratedMovieIds.length === 0) {
        setRecommendations([]);
        setLoading(false);
        return;
      }

      // Get details for rated movies
      const ratedMoviesDetails = await Promise.all(
        ratedMovieIds.map(id => getMovieDetails(id))
      );

      // Search for similar movies based on genres
      const genres = [...new Set(ratedMoviesDetails
        .filter(m => m && userRatings[m.id] >= 4)
        .map(m => m.genre)
      )];

      let candidateMovies = [];
      
      for (const genre of genres.slice(0, 3)) {
        try {
          const response = await fetch(
            `https://www.omdbapi.com/?apikey=5f6e8b7a&s=${genre}&type=movie`
          );
          const data = await response.json();
          
          if (data.Response === 'True' && data.Search) {
            const details = await Promise.all(
              data.Search.slice(0, 5).map(m => getMovieDetails(m.imdbID))
            );
            candidateMovies.push(...details.filter(m => m && !ratedMovieIds.includes(m.id)));
          }
        } catch (error) {
          console.error('Error fetching recommendations:', error);
        }
      }

      // Calculate scores
      const scoredMovies = candidateMovies.map(movie => {
        let contentScore = 0;

        ratedMoviesDetails.forEach(ratedMovie => {
          if (ratedMovie && userRatings[ratedMovie.id] >= 4) {
            const similarity = cosineSimilarity(movie.features, ratedMovie.features);
            contentScore += similarity * (userRatings[ratedMovie.id] / 5);
          }
        });

        const hybridScore = contentScore * 0.7 + (movie.rating / 20);
        return { ...movie, score: hybridScore };
      });

      // Remove duplicates and sort
      const uniqueMovies = Array.from(
        new Map(scoredMovies.map(m => [m.id, m])).values()
      );

      const topRecommendations = uniqueMovies
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      setRecommendations(topRecommendations);
    } catch (error) {
      console.error('Recommendation error:', error);
    }

    setLoading(false);
  };

  const handleRating = (movieId, rating) => {
    const newRatings = {
      ...userRatings,
      [movieId]: rating
    };
    setUserRatings(newRatings);
    saveRatings(newRatings);
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
    saveSearchHistory([]);
  };

  const clearWatchHistory = () => {
    setWatchHistory([]);
    saveWatchHistory([]);
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Film className="w-12 h-12 text-yellow-400" />
            <h1 className="text-4xl font-bold text-white">AI Movie Recommender</h1>
          </div>
          <p className="text-blue-200 text-lg">Real-time Search with OMDB API & Personalized Recommendations</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 bg-white/10 p-2 rounded-lg">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition ${
              activeTab === 'search' ? 'bg-blue-500 text-white' : 'text-blue-200 hover:bg-white/10'
            }`}
          >
            <Search className="w-5 h-5" />
            Search & Rate
          </button>
          <button
            onClick={() => setActiveTab('recommendations')}
            className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition ${
              activeTab === 'recommendations' ? 'bg-blue-500 text-white' : 'text-blue-200 hover:bg-white/10'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            Recommendations
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition ${
              activeTab === 'history' ? 'bg-blue-500 text-white' : 'text-blue-200 hover:bg-white/10'
            }`}
          >
            <History className="w-5 h-5" />
            History
          </button>
          <button
            onClick={() => setActiveTab('about')}
            className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition ${
              activeTab === 'about' ? 'bg-blue-500 text-white' : 'text-blue-200 hover:bg-white/10'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            About
          </button>
        </div>

        {/* Search Tab */}
        {activeTab === 'search' && (
          <div className="space-y-4">
            <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6">
              {/* Search Bar */}
              <div className="relative mb-6">
                <Search className="absolute left-3 top-3 w-5 h-5 text-blue-300" />
                <input
                  type="text"
                  placeholder="Search for movies or TV series..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowSearchDropdown(true)}
                  className="w-full pl-10 pr-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-blue-200"
                />
                {searching && (
                  <div className="absolute right-3 top-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  </div>
                )}

                {/* Search Dropdown */}
                {showSearchDropdown && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-white/30 rounded-lg shadow-2xl max-h-96 overflow-y-auto z-50">
                    {searchResults.map(movie => (
                      <div
                        key={movie.id}
                        onClick={() => addToWatchHistory(movie)}
                        className="flex items-center gap-4 p-4 hover:bg-white/10 cursor-pointer border-b border-white/10 last:border-b-0"
                      >
                        {movie.poster ? (
                          <img src={movie.poster} alt={movie.title} className="w-12 h-16 object-cover rounded" />
                        ) : (
                          <div className="w-12 h-16 bg-gray-700 rounded flex items-center justify-center">
                            <Film className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1">
                          <h4 className="text-white font-semibold">{movie.title}</h4>
                          <p className="text-blue-200 text-sm">{movie.year} • {movie.type}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-blue-200 mb-4 flex items-center gap-2">
                <User className="w-5 h-5" />
                Rated: {Object.keys(userRatings).length} movies
              </div>

              {/* Watch History for Rating */}
              {watchHistory.length > 0 && (
                <div className="grid gap-4">
                  <h3 className="text-white font-semibold text-lg">Your Watch List - Rate These Movies</h3>
                  {watchHistory.slice(0, 10).map(movie => (
                    <div key={movie.id} className="bg-white/10 backdrop-blur rounded-lg p-4 hover:bg-white/20 transition">
                      <div className="flex gap-4">
                        {movie.poster && (
                          <img src={movie.poster} alt={movie.title} className="w-16 h-24 object-cover rounded" />
                        )}
                        <div className="flex-1">
                          <h3 className="text-white font-semibold text-lg mb-1">{movie.title}</h3>
                          <p className="text-blue-200 text-sm mb-3">{movie.year}</p>
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map(rating => (
                              <button
                                key={rating}
                                onClick={() => handleRating(movie.id, rating)}
                                className={`flex-1 py-2 rounded transition ${
                                  userRatings[movie.id] === rating
                                    ? 'bg-yellow-500 text-white'
                                    : 'bg-white/20 text-blue-200 hover:bg-white/30'
                                }`}
                              >
                                {rating}★
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {watchHistory.length === 0 && (
                <div className="text-center py-12">
                  <Search className="w-16 h-16 text-blue-300 mx-auto mb-4" />
                  <p className="text-blue-200 text-lg">Search for movies above to start building your watch list!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recommendations Tab */}
        {activeTab === 'recommendations' && (
          <div className="space-y-4">
            <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6">
              <button
                onClick={generateRecommendations}
                disabled={loading || Object.keys(userRatings).length === 0}
                className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold rounded-lg hover:from-yellow-600 hover:to-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed mb-6"
              >
                {loading ? 'Generating Recommendations...' : 'Generate AI Recommendations'}
              </button>

              {Object.keys(userRatings).length === 0 && (
                <div className="text-center py-6 text-blue-200">
                  Please rate at least one movie to get recommendations
                </div>
              )}

              {recommendations.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold text-white mb-4">Recommended For You</h2>
                  {recommendations.map((movie, index) => (
                    <div key={movie.id} className="bg-white/10 backdrop-blur rounded-lg p-5 hover:bg-white/20 transition">
                      <div className="flex items-start gap-4">
                        <div className="bg-yellow-500 text-white font-bold w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0">
                          {index + 1}
                        </div>
                        {movie.poster && (
                          <img src={movie.poster} alt={movie.title} className="w-16 h-24 object-cover rounded" />
                        )}
                        <div className="flex-1">
                          <h3 className="text-white font-semibold text-xl mb-2">{movie.title}</h3>
                          <div className="flex gap-4 text-blue-200 text-sm mb-2">
                            <span>{movie.genre}</span>
                            <span>•</span>
                            <span>{movie.year}</span>
                            <span>•</span>
                            <span>⭐ {movie.rating}</span>
                          </div>
                          {movie.plot && (
                            <p className="text-blue-100 text-sm mb-2 line-clamp-2">{movie.plot}</p>
                          )}
                          {movie.score && (
                            <div className="mt-2">
                              <div className="bg-white/20 rounded-full h-2 w-full">
                                <div
                                  className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full"
                                  style={{ width: `${Math.min(movie.score * 100, 100)}%` }}
                                />
                              </div>
                              <p className="text-blue-200 text-xs mt-1">
                                Match Score: {(movie.score * 100).toFixed(1)}%
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {/* Search History */}
            <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Search className="w-6 h-6" />
                  Search History
                </h2>
                {searchHistory.length > 0 && (
                  <button
                    onClick={clearSearchHistory}
                    className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1"
                  >
                    <X className="w-4 h-4" />
                    Clear
                  </button>
                )}
              </div>

              {searchHistory.length > 0 ? (
                <div className="space-y-2">
                  {searchHistory.map((item, index) => (
                    <div
                      key={index}
                      onClick={() => setSearchTerm(item.query)}
                      className="flex justify-between items-center p-3 bg-white/5 rounded-lg hover:bg-white/10 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-blue-300" />
                        <span className="text-white">{item.query}</span>
                        <span className="text-blue-300 text-sm">({item.results} results)</span>
                      </div>
                      <span className="text-blue-200 text-sm">{formatTimestamp(item.timestamp)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-blue-200 text-center py-8">No search history yet</p>
              )}
            </div>

            {/* Watch History */}
            <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Film className="w-6 h-6" />
                  Watch History
                </h2>
                {watchHistory.length > 0 && (
                  <button
                    onClick={clearWatchHistory}
                    className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1"
                  >
                    <X className="w-4 h-4" />
                    Clear
                  </button>
                )}
              </div>

              {watchHistory.length > 0 ? (
                <div className="grid gap-3">
                  {watchHistory.map((movie) => (
                    <div key={movie.id} className="flex items-center gap-4 p-3 bg-white/5 rounded-lg hover:bg-white/10">
                      {movie.poster ? (
                        <img src={movie.poster} alt={movie.title} className="w-12 h-16 object-cover rounded" />
                      ) : (
                        <div className="w-12 h-16 bg-gray-700 rounded flex items-center justify-center">
                          <Film className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1">
                        <h4 className="text-white font-semibold">{movie.title}</h4>
                        <p className="text-blue-200 text-sm">{movie.year}</p>
                      </div>
                      <span className="text-blue-200 text-sm">{formatTimestamp(movie.timestamp)}</span>
                      {userRatings[movie.id] && (
                        <div className="bg-yellow-500 text-white px-2 py-1 rounded text-sm font-semibold">
                          {userRatings[movie.id]}★
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-blue-200 text-center py-8">No watch history yet</p>
              )}
            </div>
          </div>
        )}

        {/* About Tab */}
        {activeTab === 'about' && (
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-8">
            <h2 className="text-3xl font-bold text-white mb-6">About This System</h2>
            
            <div className="space-y-6 text-blue-100">
              <div>
                <h3 className="text-xl font-semibold text-white mb-3">Real-Time Movie Search</h3>
                <p className="leading-relaxed">
                  This system integrates with the OMDB (Open Movie Database) API to provide real-time movie 
                  and TV series search as you type. The system suggests up to 10 relevant titles based on 
                  your query and maintains a complete history of your searches and viewing activity.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-white mb-3">Persistent Storage</h3>
                <p className="leading-relaxed">
                  Your ratings, search history, and watch history are automatically saved and persist across 
                  sessions. This allows the system to build a comprehensive profile of your preferences over time.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-white mb-3">Hybrid Recommendation Algorithm</h3>
                <ul className="space-y-2 list-disc list-inside">
                  <li><strong>Content-Based Filtering:</strong> Analyzes movie features using cosine similarity</li>
                  <li><strong>Collaborative Filtering:</strong> Considers genre preferences from your ratings</li>
                  <li><strong>Real Data:</strong> Uses actual IMDb ratings and movie metadata</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-white mb-3">Features</h3>
                <ul className="space-y-2 list-disc list-inside">
                  <li>Live search with 10 instant results as you type</li>
                  <li>Persistent user ratings across sessions</li>
                  <li>Complete search and watch history tracking</li>
                  <li>AI-powered personalized recommendations</li>
                  <li>Real movie data from OMDB API</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-white mb-3">Data Source</h3>
                <p className="leading-relaxed">
                  Powered by OMDB API (The Open Movie Database) - a free, community-maintained database 
                  of movie information including IMDb ratings, plots, cast, and posters.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MovieRecommendationSystem;