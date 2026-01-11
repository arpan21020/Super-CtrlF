// Global state
let searchBarVisible = false;
let highlightedElements = [];
let currentMatchIndex = -1;
let allMatches = [];

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "toggleSearch") {
    toggleSearchBar();
  }
});

/**
 * Toggle the search bar visibility
 */
function toggleSearchBar() {
  const existingBar = document.getElementById('smart-search-bar');
  
  if (existingBar) {
    existingBar.remove();
    clearHighlights();
    searchBarVisible = false;
  } else {
    createSearchBar();
    searchBarVisible = true;
  }
}

/**
 * Create and inject the search bar into the page
 */
function createSearchBar() {
  // Remove any existing search bar first
  const existing = document.getElementById('smart-search-bar');
  if (existing) {
    existing.remove();
  }

  const searchContainer = document.createElement('div');
  searchContainer.id = 'smart-search-bar';
  searchContainer.innerHTML = `
    <div class="search-header">
      <input type="text" id="search-input" placeholder="Search for word..." autocomplete="off" />
      <button id="search-btn" title="Search">Search</button>
      <button id="prev-btn" title="Previous match" disabled>↑</button>
      <button id="next-btn" title="Next match" disabled>↓</button>
      <button id="close-btn" title="Close">×</button>
    </div>
    <div id="search-status">Press Enter or click Search to find similar words</div>
    <div id="search-loader" style="display: none;">
      <div class="loader-spinner"></div>
    </div>
  `;
  
  document.body.appendChild(searchContainer);
  
  // Get elements
  const input = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const closeBtn = document.getElementById('close-btn');
  
  // Focus input
  input.focus();
  
  // Event listeners
  searchBtn.addEventListener('click', performSearch);
  prevBtn.addEventListener('click', navigateToPrevious);
  nextBtn.addEventListener('click', navigateToNext);
  closeBtn.addEventListener('click', toggleSearchBar);
  
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  });

  // Prevent search bar from being selected
  searchContainer.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });
}

/**
 * Perform the search operation
 */
async function performSearch() {
  const input = document.getElementById('search-input');
  const status = document.getElementById('search-status');
  const loader = document.getElementById('search-loader');
  const searchTerm = input.value.trim();
  
  if (!searchTerm) {
    status.textContent = 'Please enter a search term';
    status.style.color = '#d32f2f';
    return;
  }
  
  // Show loader
  loader.style.display = 'flex';
  status.textContent = 'Fetching similar words...';
  status.style.color = '#5f6368';
  clearHighlights();
  
  try {
    // Get similar words from API
    const similarWords = await getSimilarWords(searchTerm);
    
    // Hide loader
    loader.style.display = 'none';
    
    if (similarWords.length === 0) {
      status.textContent = 'No similar words found';
      status.style.color = '#d32f2f';
      return;
    }
    
    // Highlight all words on page
    const count = highlightWords(similarWords);
    
    if (count === 0) {
      status.textContent = `No matches found on page for: ${similarWords.slice(0, 5).join(', ')}${similarWords.length > 5 ? '...' : ''}`;
      status.style.color = '#d32f2f';
    } else {
      status.textContent = `Found ${count} matches | Searching: ${similarWords.slice(0, 5).join(', ')}${similarWords.length > 5 ? ` +${similarWords.length - 5} more` : ''}`;
      status.style.color = '#1a73e8';
      
      // Enable navigation buttons
      const prevBtn = document.getElementById('prev-btn');
      const nextBtn = document.getElementById('next-btn');
      prevBtn.disabled = false;
      nextBtn.disabled = false;
    }
    
  } catch (error) {
    loader.style.display = 'none';
    status.textContent = 'Error: ' + error.message;
    status.style.color = '#d32f2f';
    console.error('Search error:', error);
  }
}

/**
 * Fetch similar words from API
 * Replace this with your actual API endpoint
 */
async function getSimilarWords(word) {
  /*// OPTION 1: Using DataMuse API (Free, no API key needed)
  const API_URL = 'https://api.datamuse.com/words';
  
  try {
    const response = await fetch(`${API_URL}?ml=${encodeURIComponent(word)}&max=15`);
    
    if (!response.ok) {
      throw new Error('API request failed');
    }
    
    const data = await response.json();
    
    // Extract words from response and include original search term
    const similarWords = [word];
    
    // Add similar words from API
    data.forEach(item => {
      if (item.word && item.word.toLowerCase() !== word.toLowerCase()) {
        similarWords.push(item.word);
      }
    });
    
    return similarWords;
    
  } catch (error) {
    console.error('API Error:', error);
    // Return at least the original word if API fails
    return [word];
  }
  */
  
  // OPTION 2: Your custom API
  // Uncomment and modify this section to use your own API
  const _KEY = "";
  const GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

  const YOUR_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
  
  try {
    const response = await fetch(`${YOUR_API_URL}?word=${encodeURIComponent(word)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        "Authorization": `Bearer ${_KEY}`
        // Add your API key if needed
        // 'Authorization': 'Bearer YOUR_API_KEY'
      },
      body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            {
              role: "user",
              content:
                "Return ONLY a comma-separated list of short phrases. " +
                "No explanations. Similar to: " + word
            }
          ],
          temperature: 0.4
        })
    });
    
    if (!response.ok) {
      throw new Error('API request failed');
    }
    
    const data = await response.json();
    
    if (!data.choices || !data.choices.length) {
      console.error("Unexpected Groq response:", data);
      alert("Groq API returned no results. Check API key or model.");
      return;
    }
    console.log("Groq response:", data);

    const raw = data.choices[0].message.content || "";

    const phrases = raw
      .split(",")
      .map(p => p.trim())
      .filter(p => p.length > 1);

    const terms = [word, ...phrases];
    //terms.forEach(term => highlightText(term));  
    
    return terms;
  } catch (error) {
    console.error('API Error:', error);
    return [word];
  }
  
}

/**
 * Highlight all occurrences of the words on the page
 */
function highlightWords(words) {
  const bodyText = document.body;
  let count = 0;
  allMatches = [];
  
  // Create regex pattern for all words (case-insensitive, whole words only)
  const escapedWords = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`\\b(${escapedWords.join('|')})\\b`, 'gi');
  
  // Walk through all text nodes
  const walker = document.createTreeWalker(
    bodyText,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // Skip script, style tags and our search bar
        const parent = node.parentElement;
        if (!parent || parent.closest('script, style, noscript, #smart-search-bar')) {
          return NodeFilter.FILTER_REJECT;
        }
        // Skip empty or whitespace-only nodes
        if (!node.textContent.trim()) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  const nodesToReplace = [];
  let currentNode;
  
  // Find all text nodes that contain matches
  while (currentNode = walker.nextNode()) {
    if (pattern.test(currentNode.textContent)) {
      nodesToReplace.push(currentNode);
    }
  }
  
  // Replace text nodes with highlighted spans
  nodesToReplace.forEach(node => {
    const fragment = document.createDocumentFragment();
    const text = node.textContent;
    let lastIndex = 0;
    let match;
    
    // Reset regex
    const regex = new RegExp(`\\b(${escapedWords.join('|')})\\b`, 'gi');
    
    while ((match = regex.exec(text)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
      }
      
      // Add highlighted match
      const mark = document.createElement('mark');
      mark.className = 'smart-search-highlight';
      mark.textContent = match[0];
      mark.dataset.matchIndex = count;
      fragment.appendChild(mark);
      allMatches.push(mark);
      
      count++;
      lastIndex = regex.lastIndex;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
    }
    
    // Replace the text node
    const span = document.createElement('span');
    span.appendChild(fragment);
    node.parentNode.replaceChild(span, node);
    highlightedElements.push(span);
  });
  
  // Scroll to and highlight first match
  if (allMatches.length > 0) {
    currentMatchIndex = 0;
    updateCurrentMatch();
  }
  
  return count;
}

/**
 * Update the current match highlight
 */
function updateCurrentMatch() {
  // Remove current-match class from all
  allMatches.forEach(mark => {
    mark.classList.remove('current-match');
  });
  
  // Add to current match
  if (currentMatchIndex >= 0 && currentMatchIndex < allMatches.length) {
    const currentMark = allMatches[currentMatchIndex];
    currentMark.classList.add('current-match');
    currentMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Update status
    const status = document.getElementById('search-status');
    if (status) {
      const currentText = status.textContent;
      const baseText = currentText.split(' | Match ')[0];
      status.textContent = `${baseText} | Match ${currentMatchIndex + 1}/${allMatches.length}`;
    }
  }
}

/**
 * Navigate to previous match
 */
function navigateToPrevious() {
  if (allMatches.length === 0) return;
  
  currentMatchIndex--;
  if (currentMatchIndex < 0) {
    currentMatchIndex = allMatches.length - 1;
  }
  updateCurrentMatch();
}

/**
 * Navigate to next match
 */
function navigateToNext() {
  if (allMatches.length === 0) return;
  
  currentMatchIndex++;
  if (currentMatchIndex >= allMatches.length) {
    currentMatchIndex = 0;
  }
  updateCurrentMatch();
}

/**
 * Clear all highlights from the page
 */
function clearHighlights() {
  highlightedElements.forEach(span => {
    const parent = span.parentNode;
    if (parent) {
      // Replace span with its text content
      const textNode = document.createTextNode(span.textContent);
      parent.replaceChild(textNode, span);
      // Normalize to merge adjacent text nodes
      parent.normalize();
    }
  });
  
  highlightedElements = [];
  allMatches = [];
  currentMatchIndex = -1;
  
  // Disable navigation buttons
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  if (prevBtn) prevBtn.disabled = true;
  if (nextBtn) nextBtn.disabled = true;
}

// Handle extension unload
window.addEventListener('beforeunload', () => {
  clearHighlights();
});

console.log('Smart Search Extension loaded');