console.log("iOS Keyboard Script Loaded"); // Top-level log

// iOS Keyboard Adjustment Script
// This script handles the viewport adjustments needed for iOS devices
// to maintain the "sandwich" layout when the on-screen keyboard appears

// Detect if the device is iOS
function isIOS() {
  // More robust check for iOS devices, including iPadOS 13+
  return (
    [
      "iPad Simulator",
      "iPhone Simulator",
      "iPod Simulator",
      "iPad",
      "iPhone",
      "iPod",
    ].includes(navigator.platform) ||
    // iPad on iOS 13 detection
    (navigator.userAgent.includes("Mac") && "ontouchend" in document)
  );
}

// Adjust layout for iOS devices when the keyboard appears/disappears
function adjustLayoutForIOS() {
  console.log("iOS Adjust: adjustLayoutForIOS() called"); // Log entry
  const chatModal = document.getElementById("chatModal");
  if (!chatModal || !chatModal.classList.contains("active")) {
    // console.log("iOS Adjust: Chat modal not active");
    return; // Only run if chat modal is active
  }

  const footer = chatModal.querySelector(".message-input-container");
  const content = chatModal.querySelector(".messages-container");
  const messageInput = chatModal.querySelector(".message-input");

  if (!footer || !content || !messageInput) {
    console.error("iOS Adjust: Could not find required elements in chat modal.");
    return;
  }

  if (window.visualViewport) {
    const viewport = window.visualViewport;
    const keyboardHeight = Math.max(0, window.innerHeight - viewport.height);
    console.log(`iOS Adjust: keyboardHeight = ${keyboardHeight}`);

    if (keyboardHeight > 0) {
      // Keyboard is visible
      console.log(`iOS Adjust: Applying transform translateY(-${keyboardHeight}px)`);
      footer.style.transform = `translateY(-${keyboardHeight}px)`;
      console.log(`iOS Adjust: Applying paddingBottom ${keyboardHeight}px`);
      content.style.paddingBottom = `${keyboardHeight}px`;

      // --- DISABLED Scroll the focused element into view --- 
      // if (document.activeElement === messageInput) {
      //   console.log("iOS Adjust: Scrolling input into view (DISABLED)");
      //   // setTimeout(() => {
      //   //   messageInput.scrollIntoView({ behavior: "smooth", block: "nearest" });
      //   // }, 50);
      // }
    } else {
      // Keyboard is hidden
      console.log("iOS Adjust: Resetting styles");
      footer.style.transform = "";
      content.style.paddingBottom = "";
    }
  } else {
    console.log("iOS Adjust: window.visualViewport not available.");
  }
}

// Initialize the iOS keyboard adjustment
function initIOSKeyboardAdjustment() {
  console.log("iOS Adjust: initIOSKeyboardAdjustment() called"); // Log entry
  const isDeviceIOS = isIOS();
  const viewportAvailable = !!window.visualViewport;
  console.log(`iOS Adjust: isIOS = ${isDeviceIOS}`);
  console.log(`iOS Adjust: visualViewport available = ${viewportAvailable}`);

  if (isDeviceIOS && viewportAvailable) {
    console.log("iOS Adjust: Initializing listeners.");

    // Listen for viewport changes (keyboard appearance/disappearance)
    window.visualViewport.addEventListener("resize", adjustLayoutForIOS);

    // --- Removed scroll listener as resize should cover keyboard changes ---
    // window.visualViewport.addEventListener("scroll", adjustLayoutForIOS);

    // Attempt initial adjustment on load (might be needed if loaded with keyboard)
    window.addEventListener("load", adjustLayoutForIOS);

    // --- Removed generic click listener, replaced with focus listeners ---
    // document.addEventListener("click", function(e) {
    //   setTimeout(adjustLayoutForIOS, 100);
    // });

    // More reliable: Trigger adjustment when the input field gains focus
    // Use event delegation on the document in case the modal is added dynamically
    document.addEventListener("focusin", (event) => {
      if (event.target.matches("#chatModal .message-input")) {
        console.log("iOS Adjust: Input focused, running adjustment.");
        // Need a slight delay as the keyboard animation starts
        setTimeout(adjustLayoutForIOS, 150);
      }
    });

    // Reset styles when the input field loses focus (keyboard might hide)
    document.addEventListener("focusout", (event) => {
      if (event.target.matches("#chatModal .message-input")) {
        console.log("iOS Adjust: Input blurred, resetting styles.");
        // Reset styles shortly after blur, assuming keyboard hides
        setTimeout(() => {
          const chatModal = document.getElementById("chatModal");
          if (chatModal && chatModal.classList.contains("active")) {
             const footer = chatModal.querySelector(".message-input-container");
             const content = chatModal.querySelector(".messages-container");
             if(footer) footer.style.transform = "";
             if(content) content.style.paddingBottom = "";
          }
        }, 100);
      }
    });

     // Run adjustment when the chat modal is opened
     // We need to observe when the 'active' class is added.
     const chatModalObserver = new MutationObserver((mutationsList) => {
         for(const mutation of mutationsList) {
             if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                 const targetElement = mutation.target;
                 if (targetElement.classList.contains('active')) {
                     console.log("iOS Adjust: Chat modal became active, running initial adjustment.");
                     // Run adjustment shortly after modal becomes active
                     setTimeout(adjustLayoutForIOS, 50);
                 } else {
                     // Optionally reset styles when modal closes
                     const footer = targetElement.querySelector(".message-input-container");
                     const content = targetElement.querySelector(".messages-container");
                     if(footer) footer.style.transform = "";
                     if(content) content.style.paddingBottom = "";
                     console.log("iOS Adjust: Chat modal closed, styles reset.");
                 }
             }
         }
     });

     const chatModalElement = document.getElementById('chatModal');
     if (chatModalElement) {
         chatModalObserver.observe(chatModalElement, { attributes: true });
     } else {
         console.error("iOS Adjust: Could not find chatModal element to observe.");
     }

  } else {
    console.log("iOS Adjust: Skipping initialization (Not iOS or no visualViewport).");
  }
}

// Call the initialization function when the DOM is loaded
document.addEventListener("DOMContentLoaded", initIOSKeyboardAdjustment); 