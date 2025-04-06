console.log("iOS Keyboard Script Loaded - Simplified RAF Version");

// iOS Keyboard Adjustment Script (Simplified RAF Version)
// Uses only visualViewport.resize and requestAnimationFrame

// Detect if the device is iOS
function isIOS() {
  return (
    [
      "iPad Simulator", "iPhone Simulator", "iPod Simulator",
      "iPad", "iPhone", "iPod"
    ].includes(navigator.platform) ||
    (navigator.userAgent.includes("Mac") && "ontouchend" in document)
  );
}

// We no longer need isRAFScheduled with the debounce approach
// let isRAFScheduled = false; 
let resizeDebounceTimer = null; // Timer for debouncing resize events

// Function to apply layout adjustments
function applyIOSLayoutAdjustments() {
  // Reset flag

  const chatModal = document.getElementById("chatModal");
  // Only run if chat modal is active
  if (!chatModal || !chatModal.classList.contains("active")) {
    // console.log("iOS Adjust RAF: Chat modal not active");
    return;
  }

  const footer = chatModal.querySelector(".message-input-container");
  const content = chatModal.querySelector(".messages-container");

  if (!footer || !content) {
    console.error("iOS Adjust RAF: Could not find required elements.");
    return;
  }

  if (window.visualViewport) {
    const viewport = window.visualViewport;
    const keyboardHeight = Math.max(0, window.innerHeight - viewport.height);

    console.log(`iOS Adjust RAF: keyboardHeight = ${keyboardHeight}`);

    if (keyboardHeight > 0) {
      // Apply styles for visible keyboard
      footer.style.transform = `translateY(-${keyboardHeight}px)`;
      content.style.paddingBottom = `${keyboardHeight}px`;
      console.log("iOS Adjust RAF: Applied styles for visible keyboard.");
    } else {
      // Reset styles for hidden keyboard
      footer.style.transform = "";
      content.style.paddingBottom = "";
      console.log("iOS Adjust RAF: Reset styles.");
    }
  } else {
    console.warn("iOS Adjust RAF: window.visualViewport not available.");
  }
}

// Resize event handler - schedules the adjustment using RAF with debouncing
function handleViewportResize() {
  // Clear any previously scheduled timeout
  clearTimeout(resizeDebounceTimer);

  // Set a new timeout to schedule the adjustment after a short delay
  resizeDebounceTimer = setTimeout(() => {
    // Only schedule RAF if the timeout actually runs (wasn't cleared)
    console.log("iOS Adjust Debounce: Timer finished, scheduling RAF.");
    requestAnimationFrame(applyIOSLayoutAdjustments);
  }, 150); // Debounce timeout in milliseconds (adjust as needed)
}

// Initialize the iOS keyboard adjustment
function initIOSKeyboardAdjustmentSimplified() {
  console.log("iOS Adjust RAF: init called");
  if (isIOS() && window.visualViewport) {
    console.log("iOS Adjust RAF: Initializing resize listener.");
    window.visualViewport.addEventListener("resize", handleViewportResize);

    // Initial check in case loaded with keyboard already open
    requestAnimationFrame(applyIOSLayoutAdjustments);

  } else {
    console.log(
      "iOS Adjust RAF: Skipping initialization (Not iOS or no visualViewport)."
    );
  }
}

// Call the initialization function when the DOM is loaded
document.addEventListener("DOMContentLoaded", initIOSKeyboardAdjustmentSimplified); 