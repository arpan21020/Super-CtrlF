// Background service worker for the Smart Search extension

console.log('Smart Search Extension background service worker loaded');

// Listen for the keyboard command
chrome.commands.onCommand.addListener((command) => {
  console.log('Command received:', command);
  
  if (command === "trigger-search") {
    handleSearchToggle();
  }
});

// Listen for extension icon click (if action permission is available)
if (chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener((tab) => {
    console.log('Extension icon clicked');
    handleSearchToggle(tab);
  });
}

/**
 * Handle toggling the search bar
 */
function handleSearchToggle(tab = null) {
  // Get the active tab if not provided
  if (tab) {
    sendToggleMessage(tab);
  } else {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
        console.error('No active tab found');
        return;
      }
      sendToggleMessage(tabs[0]);
    });
  }
}

/**
 * Send toggle message to content script
 */
function sendToggleMessage(tab) {
  // Check if we can inject into this tab
  if (!tab.url || 
      tab.url.startsWith('chrome://') || 
      tab.url.startsWith('chrome-extension://') ||
      tab.url.startsWith('edge://') ||
      tab.url.startsWith('about:') ||
      tab.url.startsWith('chrome-search://')) {
    console.log('Cannot inject into browser pages:', tab.url);
    return;
  }
  
  // Send message to content script
  chrome.tabs.sendMessage(tab.id, { action: "toggleSearch" }, (response) => {
    if (chrome.runtime.lastError) {
      console.log('Content script not ready, injecting...', chrome.runtime.lastError.message);
      
      // If content script is not loaded, inject it
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      }).then(() => {
        console.log('Content script injected');
        
        // Inject CSS
        return chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['searchbar.css']
        });
      }).then(() => {
        console.log('CSS injected');
        
        // Try sending message again after a short delay
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, { action: "toggleSearch" });
        }, 100);
      }).catch(err => {
        console.error('Failed to inject scripts:', err);
      });
    } else {
      console.log('Message sent successfully');
    }
  });
}

// Handle installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed/updated', details);
  
  if (details.reason === 'install') {
    console.log('First time installation');
    console.log('Press Ctrl+Shift+F to activate search on any webpage');
  } else if (details.reason === 'update') {
    console.log('Extension updated to version', chrome.runtime.getManifest().version);
  }
});