console.log("iOS Keyboard Script Loaded - Simplified RAF Version");

// iOS Keyboard Adjustment Script (Simplified RAF Version)
// Uses only visualViewport.resize and requestAnimationFrame

// Detect if the device is iOS
function isIOS() {
  const isDeviceIOS = [
      "iPad Simulator", "iPhone Simulator", "iPod Simulator",
      "iPad", "iPhone", "iPod"
    ].includes(navigator) ||
    (navigator.userAgent.includes("Mac") && "ontouchend" in document);
  console.log(Date.now(), "iOS Adjust: isIOS() check:", isDeviceIOS);
  return isDeviceIOS;
}

let resizeDebounceTimer = null; // Timer for debouncing resize events
const DEBOUNCE_DELAY = 250; // Delay in milliseconds - Increased for more stability on iOS

// Function to apply layout adjustments
function applyIOSLayoutAdjustments() {
  console.log(Date.now(), "iOS Adjust RAF: applyIOSLayoutAdjustments START");
  // Reset flag

  const chatModal = document.getElementById("chatModal");
  // Only run if chat modal is active
  if (!chatModal || !chatModal.classList.contains("active")) {
    console.log(Date.now(), "iOS Adjust RAF: Chat modal not active, exiting applyIOSLayoutAdjustments.");
    return;
  }

  const footer = chatModal.querySelector(".message-input-container");
  const content = chatModal.querySelector(".messages-container");

  if (!footer || !content) {
    console.error(Date.now(), "iOS Adjust RAF: Could not find required elements (footer or content).");
    return;
  }

  if (window.visualViewport) {
    const viewport = window.visualViewport;
    const currentInnerHeight = window.innerHeight;
    const currentViewportHeight = viewport.height;
    const keyboardHeight = Math.max(0, currentInnerHeight - currentViewportHeight);

    console.log(Date.now(), `iOS Adjust RAF: innerH=${currentInnerHeight}, visualH=${currentViewportHeight}, calculated keyboardHeight=${keyboardHeight}`);

    if (keyboardHeight > 0) {
      // Apply styles for visible keyboard
      footer.style.transform = `translateY(-${keyboardHeight}px)`;
      content.style.paddingBottom = `${keyboardHeight}px`;
      // Prevent body and html scroll when keyboard is up
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflowY = 'hidden';
      console.log(Date.now(), `iOS Adjust RAF: Applied transform/padding. Set html/body overflow = hidden.`);
    } else {
      // Reset styles for hidden keyboard
      footer.style.transform = "";
      content.style.paddingBottom = "";
      // Restore body and html scroll when keyboard is hidden
      document.documentElement.style.overflow = '';
      document.body.style.overflowY = '';
      console.log(Date.now(), "iOS Adjust RAF: Reset transform/padding. Reset html/body overflow.");
    }

    if (content) {
      // Use scrollTop and scrollHeight to scroll to the very bottom
      const scrollTarget = content.scrollHeight;
      content.scrollTop = scrollTarget;
      console.log(Date.now(), `iOS Adjust RAF: Scrolled messages container to bottom (scrollTop = ${scrollTarget}).`);
    }
  } else {
    console.warn(Date.now(), "iOS Adjust RAF: window.visualViewport not available.");
  }
  console.log(Date.now(), "iOS Adjust RAF: applyIOSLayoutAdjustments END");
}

// Function to explicitly reset layout adjustments
function resetIOSLayoutAdjustments() {
  console.log(Date.now(), "iOS Adjust Reset: resetIOSLayoutAdjustments called.");
  const chatModal = document.getElementById("chatModal");
  if (!chatModal) {
    console.log(Date.now(), "iOS Adjust Reset: chatModal not found, exiting.");
    return; // Exit if modal not found
  }

  const footer = chatModal.querySelector(".message-input-container");
  const content = chatModal.querySelector(".messages-container");

  if (footer && content) {
    footer.style.transform = "";
    content.style.paddingBottom = "";
     // Ensure html and body scroll is restored on explicit reset
    document.documentElement.style.overflow = '';
    document.body.style.overflowY = '';
    console.log(Date.now(), "iOS Adjust Reset: Transform/padding styles reset. Reset html/body overflow.");
  } else {
     console.warn(Date.now(), "iOS Adjust Reset: Could not find footer or content to reset.");
  }
}

// Debounced Resize event handler
function handleViewportResize(event) {
  console.log(Date.now(), "iOS Adjust: handleViewportResize called. Event:", event);
  // Clear any previously scheduled timeout
  clearTimeout(resizeDebounceTimer);

  // Set a new timeout to schedule the adjustment after a short delay
  resizeDebounceTimer = setTimeout(() => {
    console.log(Date.now(), `iOS Adjust Debounce: Timer finished (${DEBOUNCE_DELAY}ms), scheduling RAF.`);
    requestAnimationFrame(applyIOSLayoutAdjustments);
  }, DEBOUNCE_DELAY);
}

// Initialize the iOS keyboard adjustment
function initIOSKeyboardAdjustmentSimplified() {
  console.log(Date.now(), "iOS Adjust RAF: initIOSKeyboardAdjustmentSimplified called");
  const chatModal = document.getElementById("chatModal"); // Find the modal

  if (isIOS() && window.visualViewport) {
    console.log(Date.now(), "iOS Adjust RAF: iOS detected and visualViewport available. Initializing listeners.");
    window.visualViewport.addEventListener("resize", handleViewportResize);
    console.log(Date.now(), "iOS Adjust RAF: Added visualViewport resize listener.");

    // Initial check only if modal is currently active
    if (chatModal && chatModal.classList.contains("active")) {
       console.log(Date.now(), "iOS Adjust RAF: Modal initially active, scheduling initial adjustment.");
       requestAnimationFrame(applyIOSLayoutAdjustments);
    } else {
        console.log(Date.now(), "iOS Adjust RAF: Modal not initially active, skipping initial adjustment.");
    }

    // Observe the chat modal for attribute changes (like class)
    if (chatModal) {
      console.log(Date.now(), "iOS Adjust: Found chatModal, setting up listeners and observer.");

      // Listen for the chat modal to be opened (Custom Event - Check if dispatched from app.js)
      chatModal.addEventListener("open", () => {
        console.log(Date.now(), "iOS Adjust: 'open' event triggered on chatModal, scheduling adjustment.");
        requestAnimationFrame(applyIOSLayoutAdjustments);
      });

      // Listen for the chat modal to be closed (Custom Event - Check if dispatched from app.js)
      chatModal.addEventListener("close", () => {
        console.log(Date.now(), "iOS Adjust: 'close' event triggered on chatModal, resetting styles.");
        resetIOSLayoutAdjustments();
      });

      // Add listener for focus events within the modal - RE-ADDED WITH DELAY
      chatModal.addEventListener('focusin', (event) => {
        console.log(Date.now(), "iOS Adjust: focusin event triggered inside chatModal. Target:", event.target);
        const messageInput = chatModal.querySelector('.message-input');
        if (event.target === messageInput) {
            console.log(Date.now(), "iOS Adjust: Message input focused. Scheduling adjustment via setTimeout (300ms) then RAF.");
            // Use setTimeout before RAF to give iOS time to settle after focus
            setTimeout(() => {
                 console.log(Date.now(), "iOS Adjust: Focus setTimeout finished, scheduling RAF.");
                 requestAnimationFrame(applyIOSLayoutAdjustments);
            }, 300); // Delay in ms
        } else {
            console.log(Date.now(), "iOS Adjust: Focusin event target was not message input.");
        }
      });

      const observer = new MutationObserver((mutationsList) => {
        console.log(Date.now(), "iOS Adjust Observer: MutationObserver callback triggered.");
        for (const mutation of mutationsList) {
           console.log(Date.now(), "iOS Adjust Observer: Processing mutation:", mutation);
          if (
            mutation.type === "attributes" &&
            mutation.attributeName === "class"
          ) {
            // Check if the 'active' class was added or removed
            const isActive = chatModal.classList.contains("active");
            console.log(Date.now(), `iOS Adjust Observer: Observed class attribute change. Modal is now active: ${isActive}`);
            if (!isActive) {
              console.log(Date.now(), "iOS Adjust Observer: Modal no longer active ('active' class removed), resetting styles.");
              resetIOSLayoutAdjustments();
            } else {
               // Optional: Re-apply adjustments if modal becomes active again and keyboard might still be up
               // requestAnimationFrame(applyIOSLayoutAdjustments);
               console.log(Date.now(), "iOS Adjust Observer: Modal became active ('active' class added).");
               // Potentially trigger adjustment here if needed when modal re-activates while keyboard might be up
               // requestAnimationFrame(applyIOSLayoutAdjustments);
            }
          }
        }
      });

      observer.observe(chatModal, { attributes: true });
      console.log(Date.now(), "iOS Adjust Observer: Started observing chatModal for attribute changes.");
      // Note: Consider disconnecting the observer if the modal/component is destroyed.
    } else {
       console.warn(Date.now(), "iOS Adjust: Could not find chatModal to observe.");
    }

    document.addEventListener('visibilitychange', () => {
      const visibilityState = document.visibilityState;
      console.log(Date.now(), `iOS Adjust: visibilitychange event. New state: ${visibilityState}`);
      if (visibilityState === 'visible') {
        console.log(Date.now(), "iOS Adjust: Page became visible.");
        // Re-apply adjustments if the modal is active when page becomes visible
        const chatModal = document.getElementById("chatModal");
        if (chatModal && chatModal.classList.contains("active")) {
          console.log(Date.now(), "iOS Adjust: Modal active on visibilitychange, scheduling adjustment.");
          requestAnimationFrame(applyIOSLayoutAdjustments);
        } else {
          console.log(Date.now(), "iOS Adjust: Modal not active on visibilitychange, skipping adjustment.");
        }
      }
    });
    console.log(Date.now(), "iOS Adjust: Added visibilitychange listener.");

  } else {
    console.log(Date.now(),
      "iOS Adjust RAF: Skipping initialization (Not iOS or no visualViewport)."
    );
  }
}

// Call the initialization function when the DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    console.log(Date.now(), "DOM fully loaded and parsed. Calling initIOSKeyboardAdjustmentSimplified.");
    initIOSKeyboardAdjustmentSimplified();
}); 