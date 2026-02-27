document.addEventListener('DOMContentLoaded', () => {
    const reviewsContainer = document.getElementById('reviews-container');
    const spotlightContainer = document.getElementById('spotlight-content');
    const messageContainer = document.getElementById('message-container');
    const searchBox = document.getElementById('search-box');

    // Filters and Sort Elements
    const ratingTiles = document.querySelectorAll('.tile-half');
    const ratingDisplay = document.getElementById('rating-display');
    const resetRatingBtn = document.getElementById('reset-rating-btn');
    const sortBtns = document.querySelectorAll('.sort-btn');

    const REVIEWS_PER_PAGE = 12; // Grid is nicer with multiples of 2,3,4 (12)
    let allReviews = [], displayedReviews = [], currentPage = 1, isLoading = false;

    // State
    let currentMinRating = 0.0;
    let currentMaxRating = 5.0;
    let ratingSelectionStep = 0; // 0: no active selection (0~5), 1: min set, 2: max set
    let tempMinRating = 0;
    let currentSortBy = 'viewingDate'; // 'viewingDate', 'releaseDate', 'rating', 'name'
    let currentSortOrder = 'desc'; // 'asc' or 'desc'

    async function initialize() {
        try {
            const response = await fetch('data/reviews.yaml');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const yamlText = await response.text();
            allReviews = jsyaml.load(yamlText) || [];

            applyFiltersAndSort();
        } catch (error) {
            console.error('로딩 실패:', error);
            messageContainer.textContent = '후기 로딩을 실패했습니다.';
        }
    }

    function generateReviewHTML(review, isSpotlight = false) {
        const isLongText = review.reviewText.length > 200;
        const initialTextClass = isLongText ? 'truncated' : '';
        const toggleButtonHTML = isLongText ? '<button class="toggle-view-btn">더보기</button>' : '';
        const details = review.rating.details;

        const wrapperClass = isSpotlight ? 'spotlight-card' : 'review-card';
        const posterClass = isSpotlight ? 'spotlight-poster' : 'review-poster';
        const contentClass = isSpotlight ? 'spotlight-content' : 'review-info';

        // Unified HTML structure that works for both by changing classes via CSS
        if (isSpotlight) {
            return `
            <article class="${wrapperClass}">
                <div class="${posterClass}">
                    <img src="${review.posterUrl}" alt="${review.title} 포스터">
                </div>
                <div class="${contentClass}">
                    <h3 class="review-title">${review.title}</h3>
                    <div class="review-meta">
                        <span class="review-rating-main" role="button" tabindex="0">
                            ⭐ ${review.rating.main.toFixed(1)}
                            <svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
                        </span>
                        <div class="detailed-ratings">
                            <ul>
                                <li><span>시나리오</span> <span>${details.scenario.toFixed(1)}</span></li>
                                <li><span>연출</span> <span>${details.direction.toFixed(1)}</span></li>
                                <li><span>연기</span> <span>${details.acting.toFixed(1)}</span></li>
                                <li><span>영상</span> <span>${details.visuals.toFixed(1)}</span></li>
                                <li><span>음향</span> <span>${details.sound.toFixed(1)}</span></li>
                            </ul>
                        </div>
                        <div class="review-meta-row" style="margin-top: 12px;">
                            <span>개봉일: ${review.releaseDate}</span>
                            <span class="review-meta-divider">|</span>
                            <span>감상일: ${review.viewingDate}</span>
                        </div>
                    </div>
                    <div class="review-body">
                        <p class="review-text ${initialTextClass}">${review.reviewText}</p>
                        ${toggleButtonHTML}
                    </div>
                </div>
            </article>`;
        } else {
            return `
            <article class="${wrapperClass}">
                <div class="review-card-header">
                    <div class="${posterClass}">
                        <img src="${review.posterUrl}" alt="${review.title} 포스터" loading="lazy">
                    </div>
                    <div class="${contentClass}">
                        <h3 class="review-title">${review.title}</h3>
                        <div class="review-meta">
                            <span class="review-rating-main" role="button" tabindex="0">
                                ⭐ ${review.rating.main.toFixed(1)}
                                <svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
                            </span>
                            <div class="detailed-ratings">
                                <ul>
                                    <li><span>시나리오</span> <span>${details.scenario.toFixed(1)}</span></li>
                                    <li><span>연출</span> <span>${details.direction.toFixed(1)}</span></li>
                                    <li><span>연기</span> <span>${details.acting.toFixed(1)}</span></li>
                                    <li><span>영상</span> <span>${details.visuals.toFixed(1)}</span></li>
                                    <li><span>음향</span> <span>${details.sound.toFixed(1)}</span></li>
                                </ul>
                            </div>
                        </div>
                        <div class="review-meta" style="margin-bottom:0;">
                            <div class="review-meta-row">
                                <span>개봉일: ${review.releaseDate}</span>
                            </div>
                            <div class="review-meta-row">
                                <span>감상일: ${review.viewingDate}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="review-body">
                    <p class="review-text ${initialTextClass}">${review.reviewText}</p>
                    ${toggleButtonHTML}
                </div>
            </article>`;
        }
    }

    function renderPage(resetPaging = true) {
        if (resetPaging) {
            currentPage = 1;
            reviewsContainer.innerHTML = '';
            spotlightContainer.innerHTML = '';
            spotlightContainer.classList.add('empty');
            document.getElementById('spotlight-container').style.display = displayedReviews.length > 0 ? 'block' : 'none';
        }

        if (displayedReviews.length === 0) {
            messageContainer.textContent = '조건에 일치하는 후기가 없습니다.';
            return;
        }
        messageContainer.textContent = '';

        let startIndex = 0;

        // Only render spotlight on page 1, and only if there's at least one review
        if (currentPage === 1 && displayedReviews.length > 0) {
            spotlightContainer.innerHTML = generateReviewHTML(displayedReviews[0], true);
            spotlightContainer.classList.remove('empty');
            startIndex = 1;
        } else if (currentPage > 1) {
            // Start from where the last page left off.
            // If page 1 had 1 spotlight + 11 normal
            // Page 2 should start from index REVIEWS_PER_PAGE
            startIndex = (currentPage - 1) * REVIEWS_PER_PAGE;
        }

        // E.g., for page 1: slice(1, 12). For page 2: slice(12, 24).
        const endIndex = Math.min(currentPage * REVIEWS_PER_PAGE, displayedReviews.length);
        const pageReviews = displayedReviews.slice(startIndex, endIndex);

        pageReviews.forEach(review => {
            reviewsContainer.insertAdjacentHTML('beforeend', generateReviewHTML(review, false));
        });

        isLoading = false;
    }

    function applyFiltersAndSort() {
        // 1. Filter
        const searchTerm = searchBox.value.toLowerCase().replace(/\s+/g, '');

        displayedReviews = allReviews.filter(review => {
            const cleanTitle = review.title.toLowerCase().replace(/\s+/g, '');
            const cleanText = review.reviewText.toLowerCase().replace(/\s+/g, '');
            const matchesSearch = searchTerm === '' || cleanTitle.includes(searchTerm) || cleanText.includes(searchTerm);
            const matchesRating = review.rating.main >= currentMinRating && review.rating.main <= currentMaxRating;

            return matchesSearch && matchesRating;
        });

        // 2. Sort
        displayedReviews.sort((a, b) => {
            let valA, valB;
            if (currentSortBy === 'viewingDate') {
                valA = new Date(a.viewingDate).getTime();
                valB = new Date(b.viewingDate).getTime();
            } else if (currentSortBy === 'releaseDate') {
                valA = new Date(a.releaseDate).getTime();
                valB = new Date(b.releaseDate).getTime();
            } else if (currentSortBy === 'rating') {
                valA = a.rating.main;
                valB = b.rating.main;
            } else if (currentSortBy === 'name') {
                // string comparison
                valA = a.title;
                valB = b.title;
            }

            if (valA < valB) return currentSortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return currentSortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        renderPage(true);
    }

    // Event Listeners
    searchBox.addEventListener('input', applyFiltersAndSort);

    // Connected Tile Logic
    function updateTileVisuals(hoverVal = null) {
        const effectiveMin = ratingSelectionStep === 1 ? tempMinRating : currentMinRating;
        const effectiveMax = hoverVal !== null && ratingSelectionStep === 1 ? hoverVal : currentMaxRating;

        // Calculate display range
        const displayMin = Math.min(effectiveMin, effectiveMax);
        const displayMax = Math.max(effectiveMin, effectiveMax);

        ratingTiles.forEach(tile => {
            const val = parseFloat(tile.dataset.value);
            tile.classList.remove('active', 'hover', 'edge');

            if (ratingSelectionStep === 0 && (currentMinRating === 0.0 && currentMaxRating === 5.0)) {
                // All inactive by default, but let's visually show them as a neutral state
                return;
            }

            if (val >= displayMin && val <= displayMax) {
                tile.classList.add('active');
            }
            if (ratingSelectionStep === 1 && val >= displayMin && val <= displayMax) {
                tile.classList.add('hover'); // Different color while selecting
            }
        });

        if (ratingSelectionStep === 0 && currentMinRating === 0.0 && currentMaxRating === 5.0) {
            ratingDisplay.textContent = '전체 (0.0 ~ 5.0)';
        } else {
            ratingDisplay.textContent = `${displayMin.toFixed(1)} ~ ${displayMax.toFixed(1)}`;
        }
    }

    ratingTiles.forEach(tile => {
        tile.addEventListener('mouseenter', (e) => {
            if (ratingSelectionStep === 1) {
                const hoverVal = parseFloat(e.target.dataset.value);
                updateTileVisuals(hoverVal);
            } else if (ratingSelectionStep === 0) {
                // Hover preview for starting point
                const hoverVal = parseFloat(e.target.dataset.value);
                ratingTiles.forEach(t => {
                    if (parseFloat(t.dataset.value) <= hoverVal) {
                        t.classList.add('preview');
                    } else {
                        t.classList.remove('preview');
                    }
                });
            }
        });

        tile.addEventListener('mouseleave', () => {
            ratingTiles.forEach(t => t.classList.remove('preview'));
            if (ratingSelectionStep === 1) updateTileVisuals();
        });

        tile.addEventListener('click', (e) => {
            const val = parseFloat(e.target.dataset.value);

            if (ratingSelectionStep === 0 || ratingSelectionStep === 2) {
                // Start new selection
                ratingSelectionStep = 1;
                tempMinRating = val;
                // Temp max is same as min on first click
                currentMinRating = tempMinRating;
                currentMaxRating = tempMinRating;
                updateTileVisuals();
            } else if (ratingSelectionStep === 1) {
                // Finish selection
                const val1 = tempMinRating;
                const val2 = val;
                currentMinRating = Math.min(val1, val2);
                currentMaxRating = Math.max(val1, val2);
                ratingSelectionStep = 2;
                updateTileVisuals();
                applyFiltersAndSort();
            }
        });
    });

    resetRatingBtn.addEventListener('click', () => {
        currentMinRating = 0.0;
        currentMaxRating = 5.0;
        ratingSelectionStep = 0;
        updateTileVisuals();
        applyFiltersAndSort();
    });

    // Initial visual state
    updateTileVisuals();

    sortBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetBtn = e.currentTarget;
            const clickedSortBy = targetBtn.dataset.sort;

            if (currentSortBy === clickedSortBy) {
                // Toggle order
                currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                // Change sort basis, set to target's default order
                sortBtns.forEach(b => b.classList.remove('active'));
                targetBtn.classList.add('active');
                currentSortBy = clickedSortBy;
                // Determine initial order based on sort type
                currentSortOrder = clickedSortBy === 'name' ? 'asc' : 'desc';
            }

            // Update UI direction arrow
            targetBtn.classList.remove('desc', 'asc');
            targetBtn.classList.add(currentSortOrder);
            targetBtn.querySelector('.icon').textContent = currentSortOrder === 'asc' ? '▲' : '▼';

            applyFiltersAndSort();
        });
    });

    document.body.addEventListener('click', e => {
        // Read More toggle
        if (e.target.matches('.toggle-view-btn')) {
            const textElement = e.target.previousElementSibling;
            textElement.classList.toggle('truncated');
            e.target.textContent = textElement.classList.contains('truncated') ? '더보기' : '접기';
        }

        // Rating Details toggle
        const ratingBadge = e.target.closest('.review-rating-main');
        if (ratingBadge) {
            ratingBadge.classList.toggle('is-open');
            const container = ratingBadge.closest('.review-meta');
            const details = container.querySelector('.detailed-ratings');
            if (details) details.classList.toggle('show');
        }
    });

    window.addEventListener('scroll', () => {
        if (isLoading) return;
        if ((currentPage * REVIEWS_PER_PAGE) >= displayedReviews.length) return;

        if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) {
            isLoading = true;
            currentPage++;
            setTimeout(() => renderPage(false), 300);
        }
    });

    initialize();
});
