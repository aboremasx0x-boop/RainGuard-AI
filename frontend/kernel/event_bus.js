/*
RainGuard AI Kernel - Event Bus
frontend/kernel/event_bus.js
*/

window.RainGuardKernel = window.RainGuardKernel || {};

window.RainGuardKernel.EventBus = {
    events: {},

    on(eventName, callback) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }

        this.events[eventName].push(callback);
    },

    emit(eventName, payload) {
        const listeners = this.events[eventName] || [];

        listeners.forEach(callback => {
            try {
                callback(payload);
            } catch (error) {
                console.error("EventBus listener error:", eventName, error);
            }
        });

        console.log("Kernel Event:", eventName, payload);
    }
};
