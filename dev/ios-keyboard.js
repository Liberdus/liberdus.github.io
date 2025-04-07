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

// Add a global flag to track adjustment state and a threshold
let isKeyboardAdjusted = false;
const KEYBOARD_THRESHOLD = 50; // Minimum height in pixels to consider keyboard 'up'

// Function to apply layout adjustments
function applyIOSLayoutAdjustments() {
  console.log(Date.now(), "iOS Adjust RAF: applyIOSLayoutAdjustments START");

  const chatModal = document.getElementById("chatModal");
  if (!chatModal || !chatModal.classList.contains("active")) {
    console.log(Date.now(), "iOS Adjust RAF: Chat modal not active, exiting applyIOSLayoutAdjustments.");
    // Ensure flag is reset if modal becomes inactive unexpectedly
    if (isKeyboardAdjusted) {
      console.log(Date.now(), "iOS Adjust RAF: Modal inactive, resetting flag.")
      isKeyboardAdjusted = false;
      // Optionally reset body/html overflow here too if needed
      // document.documentElement.style.overflow = '';
      // document.body.style.overflowY = '';
    }
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

    console.log(Date.now(), `iOS Adjust RAF: innerH=${currentInnerHeight}, visualH=${currentViewportHeight}, calculated keyboardHeight=${keyboardHeight}, currently adjusted=${isKeyboardAdjusted}`);

    if (keyboardHeight > KEYBOARD_THRESHOLD) {
      // Keyboard is definitively up
      if (!isKeyboardAdjusted) {
        // Apply styles only if not already adjusted
        console.log(Date.now(), `iOS Adjust RAF: Applying styles (keyboardHeight=${keyboardHeight} > ${KEYBOARD_THRESHOLD}). Setting adjusted=true`);
        footer.style.transform = `translateY(-${keyboardHeight}px)`;
        content.style.paddingBottom = `${keyboardHeight}px`;
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflowY = 'hidden';
        isKeyboardAdjusted = true;
      } else {
         // Already adjusted, keyboard still up. Optional: Update values if height changed slightly
         console.log(Date.now(), `iOS Adjust RAF: Keyboard up, already adjusted. (keyboardHeight=${keyboardHeight})`);
         // If you notice the height changing slightly while keyboard is up, uncomment these lines:
         // footer.style.transform = `translateY(-${keyboardHeight}px)`;
         // content.style.paddingBottom = `${keyboardHeight}px`;
      }
    } else if (keyboardHeight <= KEYBOARD_THRESHOLD && isKeyboardAdjusted) {
      // Keyboard is definitively down/gone, and we were previously adjusted
      console.log(Date.now(), `iOS Adjust RAF: Resetting styles (keyboardHeight=${keyboardHeight} <= ${KEYBOARD_THRESHOLD} and was adjusted). Setting adjusted=false`);
      footer.style.transform = "";
      content.style.paddingBottom = "";
      document.documentElement.style.overflow = '';
      document.body.style.overflowY = '';
      isKeyboardAdjusted = false;
    } else {
      // Keyboard is down/gone, and we weren't adjusted (or already reset). Do nothing.
      console.log(Date.now(), `iOS Adjust RAF: Keyboard down or threshold not met (keyboardHeight=${keyboardHeight}), and not previously adjusted or already reset. Doing nothing.`);
    }

    // Scrolling might still be useful on every check
    if (content) {
      const scrollTarget = content.scrollHeight;
      // Only scroll if the keyboard is considered up, to prevent jumps when resetting
      if (isKeyboardAdjusted) {
          content.scrollTop = scrollTarget;
          console.log(Date.now(), `iOS Adjust RAF: Scrolled messages container to bottom (scrollTop = ${scrollTarget}) while adjusted.`);
      } else {
          console.log(Date.now(), `iOS Adjust RAF: Skipping scroll as not adjusted.`);
      }
    }
  } else {
    console.warn(Date.now(), "iOS Adjust RAF: window.visualViewport not available.");
  }
  console.log(Date.now(), "iOS Adjust RAF: applyIOSLayoutAdjustments END");
}

// Helper function to schedule adjustment using nested RAF for more stability
function scheduleAdjustmentRAF() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      console.log(Date.now(), "iOS Adjust: Nested RAF triggered, calling applyIOSLayoutAdjustments.");
      applyIOSLayoutAdjustments();
    });
  });
}

// Function to explicitly reset layout adjustments
function resetIOSLayoutAdjustments() {
  console.log(Date.now(), "iOS Adjust Reset: resetIOSLayoutAdjustments called.");
  const chatModal = document.getElementById("chatModal");
  if (!chatModal) {
    console.log(Date.now(), "iOS Adjust Reset: chatModal not found, exiting.");
    isKeyboardAdjusted = false; // Reset flag even if modal not found
    return;
  }

  const footer = chatModal.querySelector(".message-input-container");
  const content = chatModal.querySelector(".messages-container");

  if (footer && content) {
    footer.style.transform = "";
    content.style.paddingBottom = "";
    document.documentElement.style.overflow = '';
    document.body.style.overflowY = '';
    console.log(Date.now(), "iOS Adjust Reset: Transform/padding styles reset. Reset html/body overflow.");
  } else {
     console.warn(Date.now(), "iOS Adjust Reset: Could not find footer or content to reset.");
  }
  // ALWAYS reset the flag on explicit reset
  isKeyboardAdjusted = false;
  console.log(Date.now(), `iOS Adjust Reset: Flag set to ${isKeyboardAdjusted}`);
}

// Debounced Resize event handler
function handleViewportResize(event) {
  console.log(Date.now(), "iOS Adjust: handleViewportResize called. Event:", event);
  // Clear any previously scheduled timeout
  clearTimeout(resizeDebounceTimer);

  // Set a new timeout to schedule the adjustment after a short delay
  resizeDebounceTimer = setTimeout(() => {
    console.log(Date.now(), `iOS Adjust Debounce: Timer finished (${DEBOUNCE_DELAY}ms), scheduling nested RAF.`);
    scheduleAdjustmentRAF(); // Use nested RAF scheduler
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
            console.log(Date.now(), "iOS Adjust: Message input focused. Scheduling adjustment via setTimeout (300ms) then nested RAF.");
            // Use setTimeout before RAF to give iOS time to settle after focus
            setTimeout(() => {
                 console.log(Date.now(), "iOS Adjust: Focus setTimeout finished, scheduling nested RAF.");
                 scheduleAdjustmentRAF(); // Use nested RAF scheduler
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