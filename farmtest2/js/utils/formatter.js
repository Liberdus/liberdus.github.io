/**
 * Formatting Utilities
 * 
 * Provides formatting functions for displaying numbers, addresses, currencies, and timestamps.
 * All functions are attached to window.Formatter for global access.
 */
window.Formatter = {
    /**
     * Format numbers with subscript notation for small decimal parts (e.g., 5e-17 → 0.0₁₆5, 10.0000000005 → 10.0₈5)
     * @param {number|string} value - The number to format
     * @returns {string} Formatted string with subscript notation for very small decimal parts
     */
    formatSmallNumberWithSubscript(value) {
        if (!value || value === '0' || value === 0 || value === '0.0') return '0';
        
        // Convert to string representation to preserve precision
        let str;
        let num;
        
        if (typeof value === 'string') {
            const trimmed = value.trim();
            num = parseFloat(trimmed);
            if (isNaN(num)) return '0';
            
            // Preserve original string precision
            if (trimmed.includes('e') || trimmed.includes('E')) {
                str = num.toFixed(20);
            } else {
                str = trimmed.includes('.') ? trimmed : trimmed + '.0';
            }
        } else {
            num = typeof value === 'number' ? value : parseFloat(value);
            if (isNaN(num) || num === 0) return '0';
            str = Math.abs(num).toFixed(20);
        }
        
        const isNegative = num < 0;
        const prefix = isNegative ? '-' : '';
        
        // Split into integer and decimal parts
        const parts = str.split('.');
        if (parts.length !== 2) return num.toString();
        
        const integerPart = parts[0];
        let decimalPart = parts[1].replace(/0+$/, ''); // Remove trailing zeros
        
        // If no decimal part, return as integer
        if (decimalPart.length === 0) return num.toString();
        
        // Check for leading zeros in decimal part (3+ zeros triggers subscript)
        // This works for both < 1 (0.0000000005) and >= 1 (10.0000000005)
        const leadingZerosMatch = decimalPart.match(/^(0+)([1-9])/);
        if (leadingZerosMatch && leadingZerosMatch[1].length >= 3) {
            const zeros = leadingZerosMatch[1].length;
            const significant = decimalPart.substring(leadingZerosMatch[1].length);
            const formatStr = integerPart === '0' 
                ? `0.0<sub>${zeros}</sub>${significant}`
                : `${integerPart}.0<sub>${zeros}</sub>${significant}`;
            return prefix + formatStr;
        }
        
        // Regular decimal formatting (less than 3 leading zeros)
        // Limit to 6 decimal places for readability
        const limited = parseFloat(`${integerPart}.${decimalPart}`).toFixed(6).replace(/\.?0+$/, '');
        return prefix + limited;
    },

    /**
     * Format pair name for display with Uniswap link
     * Simply displays the raw pair name from the contract as a clickable link
     * @param {string} pairName - The pair name from the contract
     * @param {string} lpTokenAddress - The LP token address for the Uniswap link
     * @returns {string} HTML string with clickable link to Uniswap
     */
    formatPairName(pairName, lpTokenAddress = '') {
        if (!pairName) return pairName;

        const uniswapUrl = lpTokenAddress ? 
            `https://app.uniswap.org/explore/pools/polygon/${lpTokenAddress}` : 
            `https://app.uniswap.org/explore/pools`;
        
        return `
            <a href="${uniswapUrl}" target="_blank" rel="noopener noreferrer" 
               class="pair-name-link"
               title="View pool on Uniswap">
                <span class="pair-name-link-text">${pairName}</span>
                <svg class="pair-name-link-icon" viewBox="0 0 24 24">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
            </a>
        `;
    },
};

