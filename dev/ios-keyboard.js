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

let resizeDebounceTimer = null; // Timer for debouncing resize events

// Function to apply layout adjustments
function applyIOSLayoutAdjustments() {
  // Reset flag
  console.log(`iOS Adjust [${Date.now()}]: applyIOSLayoutAdjustments CALLED`);

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

    console.log(`iOS Adjust [${Date.now()}]: Viewport height=${viewport.height}, Window height=${window.innerHeight} -> keyboardHeight = ${keyboardHeight}`);

    if (keyboardHeight > 0) {
      // Apply styles for visible keyboard
      footer.style.transform = `translateY(-${keyboardHeight}px)`;
      content.style.paddingBottom = `${keyboardHeight}px`;
      console.log(`iOS Adjust [${Date.now()}]: Applied transform/padding for keyboardHeight=${keyboardHeight}px`);
    } else {
      // Reset styles for hidden keyboard
      footer.style.transform = "";
      content.style.paddingBottom = "";
      console.log(`iOS Adjust [${Date.now()}]: Reset transform/padding (keyboardHeight=${keyboardHeight})`);
    }
  } else {
    console.warn("iOS Adjust RAF: window.visualViewport not available.");
  }
}

// Function to explicitly reset layout adjustments
function resetIOSLayoutAdjustments() {
  console.log(`iOS Adjust [${Date.now()}]: resetIOSLayoutAdjustments CALLED`);
  const chatModal = document.getElementById("chatModal");
  if (!chatModal) return; // Exit if modal not found

  const footer = chatModal.querySelector(".message-input-container");
  const content = chatModal.querySelector(".messages-container");

  if (footer && content) {
    footer.style.transform = "";
    content.style.paddingBottom = "";
    console.log(`iOS Adjust [${Date.now()}]: Styles explicitly reset.`);
  }
}

// Resize event handler - schedules the adjustment using RAF with debouncing
function handleViewportResize() {
  console.log(`iOS Adjust [${Date.now()}]: handleViewportResize TRIGGERED`);
  // Clear any previously scheduled timeout
  // clearTimeout(resizeDebounceTimer); // Removing debounce timer

  // Set a new timeout to schedule the adjustment after a short delay
  // resizeDebounceTimer = setTimeout(() => {
  // Only schedule RAF if the timeout actually runs (wasn't cleared)
  // console.log("iOS Adjust Debounce: Timer finished, scheduling RAF.");
  
  // Directly schedule the adjustment using RAF without debounce
  console.log(`iOS Adjust [${Date.now()}]: Scheduling applyIOSLayoutAdjustments via requestAnimationFrame`);
  requestAnimationFrame(applyIOSLayoutAdjustments);

  // }, 300); // Debounce timeout in milliseconds (adjust as needed)
}

// Initialize the iOS keyboard adjustment
function initIOSKeyboardAdjustmentSimplified() {
  console.log(`iOS Adjust [${Date.now()}]: initIOSKeyboardAdjustmentSimplified CALLED`);
  const chatModal = document.getElementById("chatModal"); // Find the modal

  if (isIOS() && window.visualViewport) {
    console.log(`iOS Adjust [${Date.now()}]: Attaching visualViewport 'resize' listener.`);
    window.visualViewport.addEventListener("resize", handleViewportResize);

    // Initial check only if modal is currently active
    if (chatModal && chatModal.classList.contains("active")) {
       console.log(`iOS Adjust [${Date.now()}]: Initial check - modal active, scheduling applyIOSLayoutAdjustments.`);
       requestAnimationFrame(applyIOSLayoutAdjustments);
    }

    // Observe the chat modal for attribute changes (like class)
    if (chatModal) {

      // listen for the chat modal to be opened
      chatModal.addEventListener("open", () => {
        console.log(`iOS Adjust [${Date.now()}]: 'open' event TRIGGERED, scheduling applyIOSLayoutAdjustments.`);
        requestAnimationFrame(applyIOSLayoutAdjustments);
      });

      // listen for the chat modal to be closed
      chatModal.addEventListener("close", () => {
        console.log(`iOS Adjust [${Date.now()}]: 'close' event TRIGGERED, calling resetIOSLayoutAdjustments.`);
        resetIOSLayoutAdjustments();
      });

      // Add listener for focus events within the modal
      console.log(`iOS Adjust [${Date.now()}]: Attaching 'focusin' listener to chatModal.`);
      chatModal.addEventListener('focusin', (event) => {
        console.log(`iOS Adjust [${Date.now()}]: 'focusin' event TRIGGERED on target:`, event.target);
        // Check if the focused element is the message input
        const messageInput = chatModal.querySelector('.message-input'); // Adjust selector if needed
        if (event.target === messageInput) {
            console.log(`iOS Adjust [${Date.now()}]: Message input focused, scheduling applyIOSLayoutAdjustments.`);
            // Run adjustment immediately on focus
            requestAnimationFrame(applyIOSLayoutAdjustments);
        }
      });

      const observer = new MutationObserver((mutationsList) => {
        console.log(`iOS Adjust [${Date.now()}]: MutationObserver CALLBACK TRIGGERED`);
        for (const mutation of mutationsList) {
          if (
            mutation.type === "attributes" &&
            mutation.attributeName === "class"
          ) {
            // Check if the 'active' class was removed
            const isActive = chatModal.classList.contains("active");
            if (!isActive) {
              console.log(`iOS Adjust [${Date.now()}]: Observer detected modal NO LONGER active, calling resetIOSLayoutAdjustments.`);
              resetIOSLayoutAdjustments();
            } else {
               console.log(`iOS Adjust [${Date.now()}]: Observer detected modal IS active.`);
               // Optional: Re-apply adjustments if modal becomes active again and keyboard might still be up
               // requestAnimationFrame(applyIOSLayoutAdjustments);
            }
          }
        }
      });

      observer.observe(chatModal, { attributes: true });
      console.log("iOS Adjust Observer: Started observing chatModal.");
      // Note: Consider disconnecting the observer if the modal/component is destroyed.
    } else {
       console.warn(`iOS Adjust [${Date.now()}]: Could not find chatModal to observe.`);
    }

    console.log(`iOS Adjust [${Date.now()}]: Attaching 'visibilitychange' listener to document.`);
    document.addEventListener('visibilitychange', () => {
      console.log(`iOS Adjust [${Date.now()}]: 'visibilitychange' event TRIGGERED. New state: ${document.visibilityState}`);
      if (document.visibilityState === 'visible') {
        console.log(`iOS Adjust [${Date.now()}]: Page became visible.`);
        // Re-apply adjustments if the modal is active when page becomes visible
        const chatModal = document.getElementById("chatModal");
        if (chatModal && chatModal.classList.contains("active")) {
          console.log(`iOS Adjust [${Date.now()}]: Modal active on visibilitychange, scheduling applyIOSLayoutAdjustments.`);
          requestAnimationFrame(applyIOSLayoutAdjustments);
        }
      }
    });

  } else {
    console.log(
      "iOS Adjust RAF: Skipping initialization (Not iOS or no visualViewport)."
    );
  }
}

// Call the initialization function when the DOM is loaded
document.addEventListener("DOMContentLoaded", initIOSKeyboardAdjustmentSimplified); 