/**
 * Performance Monitor - Admin Panel Optimization Tracking
 * 
 * This module tracks and reports performance improvements:
 * - Network call reduction metrics
 * - UI response time measurements
 * - Memory usage optimization
 * - User experience improvements
 */

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            // Network metrics
            networkCalls: {
                total: 0,
                fullRefreshes: 0,
                singleUpdates: 0,
                optimisticUpdates: 0,
                rollbacks: 0
            },
            
            // UI response metrics
            uiResponse: {
                buttonClickToFeedback: [],
                optimisticUpdateTime: [],
                domUpdateTime: [],
                fullRenderTime: []
            },
            
            // Memory metrics
            memory: {
                proposalsInState: 0,
                cachedRows: 0,
                pendingTransactions: 0
            },
            
            // User experience metrics
            userExperience: {
                immediateResponses: 0,
                delayedResponses: 0,
                errorRollbacks: 0,
                successfulOptimisticUpdates: 0
            }
        };
        
        this.startTime = Date.now();
        this.isMonitoring = true;
        
        // Performance targets
        this.targets = {
            networkReduction: 0.9, // 90% reduction in network calls
            uiResponseTime: 100,    // Sub-100ms UI response
            optimisticSuccessRate: 0.95 // 95% optimistic update success rate
        };
        
        console.log('📊 PerformanceMonitor initialized with targets:', this.targets);
    }

    /**
     * Track network call (full refresh vs single update)
     */
    trackNetworkCall(type, details = {}) {
        if (!this.isMonitoring) return;
        
        this.metrics.networkCalls.total++;
        
        switch (type) {
            case 'full-refresh':
                this.metrics.networkCalls.fullRefreshes++;
                console.log(`[PERF] 📡 Full refresh call #${this.metrics.networkCalls.fullRefreshes}`, details);
                break;
                
            case 'single-update':
                this.metrics.networkCalls.singleUpdates++;
                console.log(`[PERF] 🎯 Single update call #${this.metrics.networkCalls.singleUpdates}`, details);
                break;
                
            case 'optimistic':
                this.metrics.networkCalls.optimisticUpdates++;
                break;
                
            case 'rollback':
                this.metrics.networkCalls.rollbacks++;
                break;
        }
        
        // Log efficiency ratio
        if (this.metrics.networkCalls.fullRefreshes > 0) {
            const efficiency = this.metrics.networkCalls.singleUpdates / this.metrics.networkCalls.fullRefreshes;
            if (efficiency >= 5) {
                console.log(`[PERF] ✅ Excellent efficiency ratio: ${efficiency.toFixed(1)}:1 (single:full)`);
            }
        }
    }

    /**
     * Track UI response time
     */
    trackUIResponse(type, startTime, endTime = Date.now()) {
        if (!this.isMonitoring) return;
        
        const responseTime = endTime - startTime;
        
        switch (type) {
            case 'button-click':
                this.metrics.uiResponse.buttonClickToFeedback.push(responseTime);
                break;
                
            case 'optimistic-update':
                this.metrics.uiResponse.optimisticUpdateTime.push(responseTime);
                break;
                
            case 'dom-update':
                this.metrics.uiResponse.domUpdateTime.push(responseTime);
                break;
                
            case 'full-render':
                this.metrics.uiResponse.fullRenderTime.push(responseTime);
                break;
        }
        
        // Check if response time meets target
        if (responseTime <= this.targets.uiResponseTime) {
            this.metrics.userExperience.immediateResponses++;
            console.log(`[PERF] ⚡ Fast ${type} response: ${responseTime}ms`);
        } else {
            this.metrics.userExperience.delayedResponses++;
            console.log(`[PERF] 🐌 Slow ${type} response: ${responseTime}ms (target: ${this.targets.uiResponseTime}ms)`);
        }
    }

    /**
     * Track optimistic update success/failure
     */
    trackOptimisticUpdate(success, proposalId, action) {
        if (!this.isMonitoring) return;
        
        if (success) {
            this.metrics.userExperience.successfulOptimisticUpdates++;
            console.log(`[PERF] ✅ Optimistic ${action} succeeded for proposal ${proposalId}`);
        } else {
            this.metrics.userExperience.errorRollbacks++;
            console.log(`[PERF] 🔄 Optimistic ${action} rolled back for proposal ${proposalId}`);
        }
    }

    /**
     * Update memory metrics
     */
    updateMemoryMetrics(adminState, domUpdates, optimisticUI) {
        if (!this.isMonitoring) return;
        
        this.metrics.memory = {
            proposalsInState: adminState ? adminState.proposalsMap.size : 0,
            cachedRows: domUpdates ? domUpdates.proposalRowCache.size : 0,
            pendingTransactions: optimisticUI ? optimisticUI.pendingTransactions.size : 0
        };
    }

    /**
     * Calculate performance statistics
     */
    calculateStats() {
        const runtime = Date.now() - this.startTime;
        const runtimeMinutes = runtime / 60000;
        
        // Network efficiency
        const totalNetworkCalls = this.metrics.networkCalls.total;
        const networkReduction = totalNetworkCalls > 0 
            ? 1 - (this.metrics.networkCalls.fullRefreshes / totalNetworkCalls)
            : 0;
        
        // UI response averages
        const avgButtonResponse = this.calculateAverage(this.metrics.uiResponse.buttonClickToFeedback);
        const avgOptimisticUpdate = this.calculateAverage(this.metrics.uiResponse.optimisticUpdateTime);
        const avgDOMUpdate = this.calculateAverage(this.metrics.uiResponse.domUpdateTime);
        const avgFullRender = this.calculateAverage(this.metrics.uiResponse.fullRenderTime);
        
        // Success rates
        const totalOptimisticUpdates = this.metrics.userExperience.successfulOptimisticUpdates + 
                                     this.metrics.userExperience.errorRollbacks;
        const optimisticSuccessRate = totalOptimisticUpdates > 0 
            ? this.metrics.userExperience.successfulOptimisticUpdates / totalOptimisticUpdates
            : 0;
        
        // UI responsiveness
        const totalUIResponses = this.metrics.userExperience.immediateResponses + 
                               this.metrics.userExperience.delayedResponses;
        const immediateResponseRate = totalUIResponses > 0 
            ? this.metrics.userExperience.immediateResponses / totalUIResponses
            : 0;
        
        return {
            runtime: {
                totalMs: runtime,
                totalMinutes: runtimeMinutes
            },
            network: {
                totalCalls: totalNetworkCalls,
                fullRefreshes: this.metrics.networkCalls.fullRefreshes,
                singleUpdates: this.metrics.networkCalls.singleUpdates,
                reductionPercentage: networkReduction * 100,
                efficiency: this.metrics.networkCalls.singleUpdates / Math.max(this.metrics.networkCalls.fullRefreshes, 1),
                callsPerMinute: totalNetworkCalls / Math.max(runtimeMinutes, 1)
            },
            uiResponse: {
                avgButtonResponse,
                avgOptimisticUpdate,
                avgDOMUpdate,
                avgFullRender,
                immediateResponseRate: immediateResponseRate * 100
            },
            optimistic: {
                totalUpdates: totalOptimisticUpdates,
                successRate: optimisticSuccessRate * 100,
                rollbacks: this.metrics.userExperience.errorRollbacks
            },
            memory: this.metrics.memory,
            targets: {
                networkReductionMet: networkReduction >= this.targets.networkReduction,
                uiResponseMet: avgButtonResponse <= this.targets.uiResponseTime,
                optimisticSuccessMet: optimisticSuccessRate >= this.targets.optimisticSuccessRate
            }
        };
    }

    /**
     * Generate performance report
     */
    generateReport() {
        const stats = this.calculateStats();
        
        console.log('\n📊 ADMIN PANEL PERFORMANCE REPORT');
        console.log('=====================================');
        console.log(`Runtime: ${stats.runtime.totalMinutes.toFixed(1)} minutes`);
        console.log('');
        
        // Network Performance
        console.log('🌐 NETWORK PERFORMANCE:');
        console.log(`  Total calls: ${stats.network.totalCalls}`);
        console.log(`  Full refreshes: ${stats.network.fullRefreshes}`);
        console.log(`  Single updates: ${stats.network.singleUpdates}`);
        console.log(`  Reduction: ${stats.network.reductionPercentage.toFixed(1)}% ${stats.targets.networkReductionMet ? '✅' : '❌'}`);
        console.log(`  Efficiency ratio: ${stats.network.efficiency.toFixed(1)}:1`);
        console.log(`  Calls per minute: ${stats.network.callsPerMinute.toFixed(1)}`);
        console.log('');
        
        // UI Performance
        console.log('⚡ UI PERFORMANCE:');
        console.log(`  Avg button response: ${stats.uiResponse.avgButtonResponse.toFixed(0)}ms ${stats.targets.uiResponseMet ? '✅' : '❌'}`);
        console.log(`  Avg optimistic update: ${stats.uiResponse.avgOptimisticUpdate.toFixed(0)}ms`);
        console.log(`  Avg DOM update: ${stats.uiResponse.avgDOMUpdate.toFixed(0)}ms`);
        console.log(`  Immediate response rate: ${stats.uiResponse.immediateResponseRate.toFixed(1)}%`);
        console.log('');
        
        // Optimistic Updates
        console.log('🎯 OPTIMISTIC UPDATES:');
        console.log(`  Total updates: ${stats.optimistic.totalUpdates}`);
        console.log(`  Success rate: ${stats.optimistic.successRate.toFixed(1)}% ${stats.targets.optimisticSuccessMet ? '✅' : '❌'}`);
        console.log(`  Rollbacks: ${stats.optimistic.rollbacks}`);
        console.log('');
        
        // Memory Usage
        console.log('💾 MEMORY USAGE:');
        console.log(`  Proposals in state: ${stats.memory.proposalsInState}`);
        console.log(`  Cached DOM rows: ${stats.memory.cachedRows}`);
        console.log(`  Pending transactions: ${stats.memory.pendingTransactions}`);
        console.log('');
        
        // Overall Assessment
        const targetsMetCount = Object.values(stats.targets).filter(Boolean).length;
        const totalTargets = Object.keys(stats.targets).length;
        
        console.log('🎯 PERFORMANCE ASSESSMENT:');
        console.log(`  Targets met: ${targetsMetCount}/${totalTargets}`);
        
        if (targetsMetCount === totalTargets) {
            console.log('  🎉 EXCELLENT: All performance targets achieved!');
        } else if (targetsMetCount >= totalTargets * 0.8) {
            console.log('  👍 GOOD: Most performance targets achieved');
        } else {
            console.log('  ⚠️ NEEDS IMPROVEMENT: Several targets not met');
        }
        
        return stats;
    }

    /**
     * Calculate average from array of numbers
     */
    calculateAverage(numbers) {
        if (!numbers || numbers.length === 0) return 0;
        return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    }

    /**
     * Start continuous monitoring
     */
    startMonitoring() {
        this.isMonitoring = true;
        console.log('[PERF] 📊 Performance monitoring started');
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        this.isMonitoring = false;
        console.log('[PERF] ⏹️ Performance monitoring stopped');
    }

    /**
     * Reset all metrics
     */
    reset() {
        this.metrics = {
            networkCalls: { total: 0, fullRefreshes: 0, singleUpdates: 0, optimisticUpdates: 0, rollbacks: 0 },
            uiResponse: { buttonClickToFeedback: [], optimisticUpdateTime: [], domUpdateTime: [], fullRenderTime: [] },
            memory: { proposalsInState: 0, cachedRows: 0, pendingTransactions: 0 },
            userExperience: { immediateResponses: 0, delayedResponses: 0, errorRollbacks: 0, successfulOptimisticUpdates: 0 }
        };
        this.startTime = Date.now();
        console.log('[PERF] 🔄 Performance metrics reset');
    }

    /**
     * Export metrics for external analysis
     */
    exportMetrics() {
        return {
            metrics: this.metrics,
            stats: this.calculateStats(),
            timestamp: Date.now()
        };
    }
}

// Export for use in admin panel
window.PerformanceMonitor = PerformanceMonitor;
