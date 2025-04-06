// iOS Keyboard Adjustment Script
// This script handles the viewport adjustments needed for iOS devices
// to maintain the "sandwich" layout when the on-screen keyboard appears

// Detect if the device is iOS
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// Adjust layout for iOS devices when the keyboard appears
function adjustLayoutForIOS() {
  // For the chat modal
  if (document.getElementById('chatModal').classList.contains('active')) {
    const footer = document.querySelector(".message-input-container");
    const content = document.querySelector(".messages-container");

    if (window.visualViewport) {
      const viewport = window.visualViewport;
      const keyboardHeight = window.innerHeight - viewport.height - viewport.offsetTop;

      // Only apply changes if there's actually a keyboard visible
      if (keyboardHeight > 0) {
        // Adjust footer position
        footer.style.transform = `translateY(-${keyboardHeight}px)`;

        // Adjust content area to prevent it from being hidden
        content.style.paddingBottom = `${keyboardHeight}px`;

        // Ensure the focused input is visible
        const activeElement = document.activeElement;
        if (
          activeElement &&
          (activeElement.tagName === "INPUT" ||
            activeElement.tagName === "TEXTAREA")
        ) {
          activeElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      } else {
        // Reset styles when keyboard is dismissed
        footer.style.transform = "";
        content.style.paddingBottom = "";
      }
    }
  }
}

// Initialize the iOS keyboard adjustment
function initIOSKeyboardAdjustment() {
  // Only add the Visual Viewport event listeners for iOS devices
  if (isIOS() && window.visualViewport) {
    console.log("iOS device detected, initializing keyboard adjustments");
    window.visualViewport.addEventListener("resize", adjustLayoutForIOS);
    window.visualViewport.addEventListener("scroll", adjustLayoutForIOS);
    window.addEventListener("load", adjustLayoutForIOS);

    // Also adjust when switching to chat modal
    document.addEventListener("click", function(e) {
      // Add a small delay to ensure the modal is fully visible
      setTimeout(adjustLayoutForIOS, 100);
    });
  } else {
    console.log("Non-iOS device detected, skipping keyboard adjustments");
  }
}

// Call the initialization function when the DOM is loaded
document.addEventListener("DOMContentLoaded", initIOSKeyboardAdjustment); 