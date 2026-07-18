// ==UserScript==
// @name         Riverstone Dispatch Assistant
// @namespace    RLX
// @version      4.1
// @description  Manual Override + Fixed String Variable Mapping (public config version — see CONFIG block)
// @match        https://*.dispatchtrack.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_addStyle
// @grant        unsafeWindow
// ==/UserScript==

(function () {
    'use strict';
    console.log("Riverstone Dispatch Assistant v4.0 loaded.");

    const STORAGE_KEY = "riverstoneJob";
    const DELIVERIES_KEY = "riverstoneDeliveries";
    const EMITRR_QUEUE_KEY = "riverstoneEmitrrQueue";

    // ==========================================
    // 0. LOCAL CONFIGURATION (fill in before use)
    // ==========================================
    // These values are intentionally NOT hardcoded in the public script.
    // After installing the userscript, set them once from your browser
    // console (or Tampermonkey's storage editor) so they never end up
    // in source control:
    //
    //   GM_setValue("cfg_agentName", "Your Name")
    //   GM_setValue("cfg_companyName", "Your Company")
    //   GM_setValue("cfg_clientName", "Client Name")
    //   GM_setValue("cfg_clientWebsite", "https://client-site.example.com")
    //   GM_setValue("cfg_supportPhone", "555-555-5555")
    //
    // Do not commit real values back to this file.
    const CONFIG = {
        AGENT_NAME: GM_getValue("cfg_agentName", "[Your Name]"),
        COMPANY_NAME: GM_getValue("cfg_companyName", "[Your Company]"),
        CLIENT_NAME: GM_getValue("cfg_clientName", "[Client Name]"),
        CLIENT_WEBSITE: GM_getValue("cfg_clientWebsite", "[client website]"),
        SUPPORT_PHONE: GM_getValue("cfg_supportPhone", "[support phone number]")
    };

    const APP = {
        isTeams: location.hostname.includes("teams"),
        isDispatch: location.hostname.includes("dispatchtrack"),
        isScheduleView: location.hostname.includes("dispatchtrack") && /\/service-units\/[^/]+\/schedule/.test(location.pathname)
    };

    // ==========================================
    // 1. PERFECTED TEXT TEMPLATES
    // ==========================================
    const Templates = {
        NEW_WINDOW(windowTime) {
            const timeString = (windowTime && typeof windowTime === 'string' && windowTime.trim()) ? windowTime.trim() : "xx:xx XM - xx:xx XM";
            return `Hello, This is ${CONFIG.AGENT_NAME} from ${CONFIG.COMPANY_NAME}. We have received an update from your ${CONFIG.CLIENT_NAME} delivery. There is a new Window for your delivery: ${timeString} For additional information you may dial at ${CONFIG.SUPPORT_PHONE}\nWe apologize for the inconvenience. Thank you and have a great day!`;
        },
        MECHANICAL_DELAY() {
            return `Hello, This is ${CONFIG.AGENT_NAME} from ${CONFIG.COMPANY_NAME}. We have received an update from your ${CONFIG.CLIENT_NAME} order. There is a delay with your order due to mechanical issues with the truck, you will receive a new time window as soon as possible.\nFor additional information you may dial at ${CONFIG.SUPPORT_PHONE}\nWe apologize for the inconvenience. Thank you and have a great day!`;
        },
        UNABLE_TO_COMPLETE() {
            return `Hello, this is ${CONFIG.AGENT_NAME} with ${CONFIG.COMPANY_NAME} regarding your ${CONFIG.CLIENT_NAME} delivery scheduled for today. Due to some inconveniences, we are unable to complete the delivery today. Please, to reschedule call ${CONFIG.SUPPORT_PHONE} or visit ${CONFIG.CLIENT_WEBSITE}\nWe apologize for the inconvenience and appreciate your understanding.`;
        }
    };

    // Storage Engines
    function saveJob(job) { GM_setValue(STORAGE_KEY, job); }
    function loadJob() { return GM_getValue(STORAGE_KEY, null); }
    function saveDeliveries(deliveries) { GM_setValue(DELIVERIES_KEY, deliveries); }
    function loadDeliveries() { return GM_getValue(DELIVERIES_KEY, []); }
    function loadEmitrrQueue() { return GM_getValue(EMITRR_QUEUE_KEY, []); }
    function saveEmitrrQueue(queue) { GM_setValue(EMITRR_QUEUE_KEY, queue); }

    // ==========================================
    // 2. FIXED CUSTOMER ADDITION ENGINE
    // ==========================================
    function addCustomerToJob(delivery, customWindow = "") {
        const job = loadJob();
        if (!job) {
            alert("Please set a Door and Case Type first using the panel controls!");
            return;
        }
        job.customers = job.customers || [];

        // Clear out any old copies of this customer to allow updates
        job.customers = job.customers.filter(c => c.order !== delivery.order);

        // 1. Check if a manual time was typed and passed from the button click
        let selectedWindow = typeof customWindow === 'string' ? customWindow.trim() : "";

        // 2. Fallback: If nothing was passed, look up the text field directly on the screen
        if (!selectedWindow) {
            const timeInputEl = document.getElementById("manualTimeWindowInput");
            selectedWindow = timeInputEl ? timeInputEl.value.trim() : "";
        }

        // 3. Fallback: If both inputs are empty, fall back to what the page scraper found
        if (!selectedWindow) {
            selectedWindow = (typeof delivery.actualStart === 'string' && delivery.actualStart) ? delivery.actualStart : "";
        }

        job.customers.push({
            name: delivery.customer,
            phone: delivery.phone1 || delivery.phone2 || "No Phone Found",
            order: delivery.order,
            address: delivery.address,
            window: selectedWindow // Holds the clean typed string perfectly!
        });

        saveJob(job);
        refreshPanel();
    }

    function removeCustomerFromJob(order) {
        const job = loadJob();
        if (!job) return;
        job.customers = (job.customers || []).filter(c => c.order !== order);
        saveJob(job);
        refreshPanel();
    }

    // ==========================================
    // 3. CONTROL INTERFACE INJECTIONS
    // ==========================================
    function createPanel() {
        if (!APP.isDispatch || document.getElementById("riverstoneAssistant")) return;

        GM_addStyle(`
            #riverstoneAssistant { position:fixed; top:20px; right:20px; width:380px; max-height:55vh; overflow-y:auto; background:white; border:2px solid #1976d2; border-radius:8px; padding:15px; z-index:999999; font-family:Arial; box-shadow:0 5px 20px rgba(0,0,0,.25); color: #333 !important; }
            #riverstoneAssistant h2 { margin-top:0; font-size:20px; color: #1976d2; }
            #manualOverrideSection { background: #f5f5f5; border: 1px dashed #1976d2; border-radius: 6px; padding: 10px; margin-bottom: 12px; }
            #manualOverrideSection h4 { margin: 0 0 8px 0; color: #1976d2; font-size: 14px; }
            .manualRow { display: flex; gap: 8px; margin-bottom: 6px; }
            .manualRow input, .manualRow select { flex: 1; padding: 6px; border: 1px solid #ccc; border-radius: 4px; background: white; color: black; font-size: 13px; }
            #applyManualBtn { width: 100%; padding: 8px; background: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
            #riverstoneAssistant .customer { border-top:1px solid #ddd; padding-top:10px; margin-top:10px; color: #333 !important; }
            #riverstoneAssistant b { color: #000 !important; }
            #riverstoneAssistant .copyButton, #riverstoneAssistant .queueButton, #riverstoneAssistant .removeButton { width:100%; padding:10px; margin-top:10px; cursor:pointer; font-weight: bold; }
            #riverstoneAssistant .removeButton { background:#fdecea; border:1px solid #e57373; color: #c62828; }
            #riverstoneAssistant textarea { width:100%; height:120px; resize:vertical; margin-top:10px; background: #fff !important; color: #000 !important; border: 1px solid #ccc; padding: 5px; font-family: Arial; }
            #riverstoneAssistant #addCustomerSection { border-top:2px solid #1976d2; margin-top:14px; padding-top:10px; }
            #riverstoneAssistant #addCustomerSection select { width:100%; padding:6px; margin-top:6px; background: #fff; color: #000; }
            #riverstoneAssistant #addCustomerSection input { width:95%; padding:6px; margin-top:6px; background: #fff; color: #000; border: 1px solid #ccc; border-radius:4px; }
            #riverstoneAssistant #addCustomerSection button { width:100%; padding:8px; margin-top:6px; cursor:pointer; }
        `);

        const panel = document.createElement("div");
        panel.id = "riverstoneAssistant";
        panel.innerHTML = `
            <h2>🚚 Riverstone Assistant</h2>
            <div id="manualOverrideSection">
                <h4>🛠️ Manual Case Controller</h4>
                <div class="manualRow">
                    <input type="text" id="manualDoorInput" placeholder="Door (e.g. D29)" />
                    <select id="manualTypeSelect">
                        <option value="NEW_WINDOW">New Window</option>
                        <option value="MECHANICAL_DELAY">Mechanical Delay</option>
                        <option value="UNABLE_TO_COMPLETE">Unable to Complete</option>
                    </select>
                </div>
                <button id="applyManualBtn">Set Case Variables</button>
            </div>
            <div id="assistantContent">Waiting for variables...</div>
        `;
        document.body.appendChild(panel);

        document.getElementById("applyManualBtn").onclick = function() {
            const inputDoor = document.getElementById("manualDoorInput").value.trim().toUpperCase();
            const selectedType = document.getElementById("manualTypeSelect").value;
            if (!inputDoor) { alert("Please type a Door number first!"); return; }

            saveJob({
                id: "manual-" + Date.now(),
                subject: "Manual Entry",
                body: `Manual override set for ${inputDoor}`,
                type: selectedType,
                doors: [inputDoor],
                customers: [],
                received: new Date()
            });
            refreshPanel();
        };
    }

    // ==========================================
    // 4. RENDERING ENGINE (REPAIRED)
    // ==========================================
    function refreshPanel() {
        if (!APP.isDispatch) return;
        const job = loadJob();
        const container = document.getElementById("assistantContent");
        if (!container) return;
        if (!job) {
            container.innerHTML = "<b>No active notification. Complete the manual box above.</b>";
            return;
        }

        let html = `<b>Type:</b> ${job.type}<br><b>Doors:</b> ${(job.doors || []).join(", ")}<br><br>`;
        job.customers = job.customers || [];

        job.customers.forEach((customer) => {
            let message = "";
            switch (job.type) {
                case "NEW_WINDOW": message = Templates.NEW_WINDOW(customer.window); break;
                case "MECHANICAL_DELAY": message = Templates.MECHANICAL_DELAY(); break;
                case "UNABLE_TO_COMPLETE": message = Templates.UNABLE_TO_COMPLETE(); break;
            }

            html += `
            <div class="customer">
                <b>${customer.name}</b><br>${customer.phone}<br>🛡️ <i>Time Window: ${customer.window || "None Provided"}</i>
                <textarea class="msgTextarea">${message}</textarea>
                <button class="copyButton">📋 Copy Message</button>
                <button class="queueButton">🚀 Queue for Emitrr</button>
                <button class="removeButton">✖ Remove</button>
            </div>`;
        });

        const deliveries = loadDeliveries();
        html += `<div id="addCustomerSection"><b>Add customer to this notification</b>`;
        if (!deliveries.length) {
            html += `<div><small>No route data loaded. Open a Schedule page and click Scrape below.</small></div>`;
        } else {
            html += `<select id="deliveryPicker">`;
            deliveries.forEach((d) => {
                html += `<option value="${d.order}">${d.customer} — ${d.order} (Stop ${d.stop})</option>`;
            });
            html += `</select>`;
            html += `<input type="text" id="manualTimeWindowInput" placeholder="Optional: Type Window (e.g. 1:15 PM - 4:15 PM)" />`;
            html += `<button id="addCustomerBtn">➕ Add selected customer</button>`;
        }
        html += `<button id="refreshDeliveriesBtn" style="width:100%; padding:8px; margin-top:6px; cursor:pointer;">🔄 Force Scrape Page Data</button></div>`;
        container.innerHTML = html;

        // Button Assignments
        const customersEl = container.querySelectorAll(".customer");
        customersEl.forEach((el, index) => {
            const txt = el.querySelector(".msgTextarea");
            el.querySelector(".copyButton").onclick = function() {
                navigator.clipboard.writeText(txt.value);
                this.innerText = "Copied!";
                setTimeout(() => { this.innerText = "📋 Copy Message"; }, 1500);
            };
            el.querySelector(".queueButton").onclick = function() {
                queueEmitrrMessage(job.customers[index], txt.value);
                this.innerText = "Queued!";
                setTimeout(() => { this.innerText = "🚀 Queue for Emitrr"; }, 1500);
            };
            el.querySelector(".removeButton").onclick = function() {
                removeCustomerFromJob(job.customers[index].order);
            };
        });

        const addBtn = document.getElementById("addCustomerBtn");
        if (addBtn) {
            addBtn.onclick = function () {
                const order = document.getElementById("deliveryPicker").value;
                const customTime = document.getElementById("manualTimeWindowInput")?.value || "";
                const delivery = deliveries.find(d => d.order === order);

                // FIXED: Explicitly forward the custom input string to the addition function
                if (delivery) addCustomerToJob(delivery, customTime);
            };
        }

        const refreshBtn = document.getElementById("refreshDeliveriesBtn");
        if (refreshBtn) { refreshBtn.onclick = function () { if (typeof parseStops === "function") parseStops(); }; }
    }

    // ==========================================
    // 5. EMITRR QUEUE MANAGERS
    // ==========================================
    function queueEmitrrMessage(customer, message) {
        const queue = loadEmitrrQueue();
        queue.push({
            id: Date.now(),
            phone: customer.phone,
            name: customer.name,
            message,
            status: "queued",
            created: new Date().toISOString()
        });
        saveEmitrrQueue(queue);
        renderEmitrrQueue();
    }

    function createEmitrrReviewPanel() {
        if (!APP.isDispatch || document.getElementById("emitrrReviewPanel")) return;

        GM_addStyle(`
            #emitrrReviewPanel { position: fixed; bottom: 20px; left: 20px; width: 360px; max-height: 40vh; overflow-y: auto; background: #111; color: #fff; border-radius: 10px; padding: 12px; z-index: 999999; font-family: Arial; box-shadow: 0 5px 20px rgba(0,0,0,.5); }
            #emitrrReviewPanel h3 { margin-top: 0; color: #fff; }
            .emitrrItem { border-bottom: 1px solid #333; padding: 8px 0; color: #fff; }
            .emitrrBtn { width: 48%; margin-top: 6px; padding: 6px; cursor: pointer; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px; }
            .emitrrItem textarea { width: 100%; height: 80px; background: #222 !important; color: #fff !important; border: 1px solid #444 !important; margin-top: 6px; padding: 5px; font-family: Arial; resize: vertical; }
        `);

        const panel = document.createElement("div");
        panel.id = "emitrrReviewPanel";
        panel.innerHTML = `
            <h3>📤 Emitrr Queue</h3>
            <div id="emitrrQueueContainer">Loading...</div>
        `;
        document.body.appendChild(panel);
        renderEmitrrQueue();
    }

    function renderEmitrrQueue() {
        const container = document.getElementById("emitrrQueueContainer");
        if (!container) return;
        const queue = loadEmitrrQueue();
        if (!queue.length) {
            container.innerHTML = "<small>No queued messages</small>";
            return;
        }
        container.innerHTML = queue.map(item => `
            <div class="emitrrItem">
                <b>${item.name}</b> (${item.phone})<br>
                <textarea>${item.message}</textarea>
                <button class="emitrrBtn copyPhone">Copy Phone</button>
                <button class="emitrrBtn copyMsg">Copy Msg</button>
            </div>
        `).join("");

        container.querySelectorAll(".emitrrItem").forEach((el, index) => {
            el.querySelector(".copyPhone").onclick = () => navigator.clipboard.writeText(queue[index].phone);
            el.querySelector(".copyMsg").onclick = () => navigator.clipboard.writeText(queue[index].message);
        });
    }

    // ==========================================
    // 6. DISPATCHTRACK SCRAPER
    // ==========================================
    async function getOrder(orderNumber) {
        const response = await fetch(`/api_r7/service_orders/${orderNumber}`);
        if (!response.ok) throw new Error(`API Error ${response.status} for ${orderNumber}`);
        const json = await response.json();
        return json.service_order || json;
    }

    async function parseStops() {
        const cards = document.querySelectorAll("app-service-unit-stop, .stop-card");
        if (!cards.length) {
            console.warn("Riverstone: No route stop cards found on the page layout.");
            return false;
        }

        const deliveries = [];
        console.log(`Riverstone: Automated scanning of ${cards.length} cards started...`);

        for (const card of cards) {
            const text = card.innerText.replace(/\r/g, "").trim();
            const lines = text.split("\n").map(x => x.trim()).filter(Boolean);
            if (lines.length < 2) continue;

            const customerOrder = lines.find(l => /\d{7}/.test(l)) || lines[1] || "";
            const orderMatch = customerOrder.match(/\d{7}[A-Z0-9:]*/i);
            const orderNumber = orderMatch ? orderMatch[0] : "";
            if (!orderNumber) continue;

            const customer = customerOrder.substring(0, customerOrder.indexOf(orderNumber)).trim() || customerOrder;

            // Look for standard time formats on the card (e.g., "11:30 AM - 2:30 PM" or "14:00 - 17:00")
            const timeMatch = text.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/i) ||
                              text.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/i);

            // FIXED: Extract the actual string value [0] instead of passing the raw array object wrapper
            let cleanWindowText = "";
            if (timeMatch && timeMatch[0]) {
                cleanWindowText = timeMatch[0].trim();
            } else {
                // Background fallback: scan line items for individual standalone time flags
                const individualTimes = lines.filter(l => /\d{1,2}:\d{2}/.test(l));
                if (individualTimes.length >= 2) {
                    cleanWindowText = `${individualTimes[0]} - ${individualTimes[1]}`;
                }
            }

            // Find stop number safely
            const stopLine = lines.find(l => /^\d+$/.test(l)) || "1";
            const stop = parseInt(stopLine, 10) || 1;

            deliveries.push({
                stop: stop,
                customer: customer || "Unknown Customer",
                order: orderNumber,
                address: lines[2] || "",
                actualStart: cleanWindowText // Holds a true, clean text string
            });
        }

        // Asynchronously add the background phone coordinates
        for (const d of deliveries) {
            try {
                const res = await getOrder(d.order);
                d.phone1 = res.phone_1 || res.service_order?.phone_1 || "";
                d.phone2 = res.phone_2 || res.service_order?.phone_2 || "";
            } catch (e) {
                console.error(`Could not enrich phone parameters for ${d.order}`, e);
                d.phone1 = "";
                d.phone2 = "";
            }
        }

        saveDeliveries(deliveries);
        console.log(`Riverstone: Successfully cached ${deliveries.length} parsed routes automatically.`);
        refreshPanel();
        return true;
    }

    // Startup Hooks
    if (APP.isDispatch) {
        createPanel();
        refreshPanel();
        createEmitrrReviewPanel();
        setTimeout(parseStops, 2000);
    }
})();