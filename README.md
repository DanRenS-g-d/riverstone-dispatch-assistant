Riverstone Dispatch Assistant

A Tampermonkey userscript that enhances the DispatchTrack workflow for logistics dispatchers by automating customer notification preparation, route scraping, and message queue management.

Designed for dispatchers who need to quickly generate customer notifications for delivery updates while reducing repetitive manual work.


Features

Route Scraper


Automatically scans the current DispatchTrack schedule page.
Extracts:

Customer name
Order number
Stop number
Address
Delivery time window



Retrieves customer phone numbers directly from the DispatchTrack API.
Stores parsed deliveries for quick selection.



Manual Case Controller

Create notification jobs without relying on automatic detection.

Supports three notification types:


New Window
Mechanical Delay
Unable to Complete


Each job contains:


Door number
Notification type
Customer list



Customer Manager

Add customers from the current route into the active notification.

Features:


Select any scraped delivery
Override the delivery window manually
Remove customers from a notification
Preserve customer information between page refreshes



Message Generator

Automatically generates customer-ready text messages.

Templates include:


New delivery window
Mechanical delay
Unable to complete delivery


Messages are personalized with:


Customer delivery window (when applicable)
Your company's contact information
Standard company messaging


One-click copy to clipboard.


Emitrr Queue

Instead of immediately sending messages, the script allows dispatchers to queue them for review.

Queue features:


Customer name
Phone number
Editable message
Copy phone number
Copy message


Useful for sending messages through Emitrr or another SMS platform.


Persistent Storage

Uses Tampermonkey's storage API to retain:


Current notification job
Parsed deliveries
Emitrr message queue


Data remains available after page reloads.


Installation

Requirements


Google Chrome, Microsoft Edge, Firefox, or another browser supporting Tampermonkey
Tampermonkey extension installed
Access to DispatchTrack


Install


Install Tampermonkey.
Create a new userscript.
Replace the default template with this script.
Save.
Configure your local settings (see below).
Open DispatchTrack.


The assistant automatically loads on supported DispatchTrack pages.


Configuration (required before first use)

To keep this repo free of any personal or client-specific information, the script does not ship with your name, company name, client name, or phone numbers baked in. Instead, it reads them from Tampermonkey's local storage at runtime.

Open your browser console on any DispatchTrack page (with the script installed) and run each line once, substituting your real values:

jsGM_setValue("cfg_agentName", "Your Name");
GM_setValue("cfg_companyName", "Your Company");
GM_setValue("cfg_clientName", "Client Name");
GM_setValue("cfg_clientWebsite", "https://client-site.example.com");
GM_setValue("cfg_supportPhone", "555-555-5555");

These values are stored locally by Tampermonkey and are never written back into the script or committed to this repository. Anyone forking this repo needs to set their own values before the message templates will look correct.


Supported Website

https://*.dispatchtrack.com/*

Note: This script reads data from an undocumented/internal DispatchTrack API endpoint. It is intended for personal, internal workflow automation. Before using it in a business setting or distributing it to coworkers, confirm that automated access to your DispatchTrack instance is permitted under your organization's agreement with DispatchTrack — internal APIs can change without notice and some SaaS terms of service restrict scripted access.


Usage

1. Open a Schedule

Navigate to a DispatchTrack route schedule.

The script automatically:


Loads the assistant panel
Scrapes deliveries
Retrieves phone numbers


2. Create a Notification

Enter:


Door number
Notification type


Click: Set Case Variables

3. Add Customers

Choose a customer from the dropdown.

Optionally type a custom delivery window.

Click: Add Selected Customer

4. Generate Messages

Each customer receives a pre-built message.

Options include:


Copy Message
Queue for Emitrr
Remove Customer


5. Review Emitrr Queue

The lower-left panel displays queued notifications.

Each entry allows:


Copy Phone
Copy Message



Notification Types

New Window — Generates a customer notification containing an updated delivery window.

Mechanical Delay — Informs the customer that the truck experienced mechanical issues and a new delivery window will follow.

Unable to Complete — Notifies the customer that the delivery cannot be completed today and provides rescheduling instructions.


Technical Overview

Built With


JavaScript (ES6)
Tampermonkey APIs
DispatchTrack REST API
DOM parsing


Tampermonkey APIs Used


GM_getValue
GM_setValue
GM_addStyle



Storage Keys

KeyPurposeriverstoneJobActive notification jobriverstoneDeliveriesCached route datariverstoneEmitrrQueueQueued messagescfg_agentNameYour name, inserted into templatescfg_companyNameYour company name, inserted into templatescfg_clientNameClient name, inserted into templatescfg_clientWebsiteClient rescheduling websitecfg_supportPhoneSupport phone number shown to customers


Workflow

DispatchTrack Schedule
        │
        ▼
Automatic Route Scraper
        │
        ▼
Delivery Cache
        │
        ▼
Manual Case Selection
        │
        ▼
Add Customers
        │
        ▼
Generate Messages
        │
        ▼
Queue for Emitrr


Version

Current Version: 4.1

Highlights


Manual case controller
Improved delivery scraping
Correct delivery window parsing
Manual time window overrides
Phone number enrichment through API
Persistent Emitrr queue
Improved customer management
Cleaner UI panels
Personal/client details externalized into local config (v4.1)



Notes

This userscript is intended for internal operational use with DispatchTrack. It automates repetitive dispatcher tasks while preserving manual control over customer communications.

It does not store, transmit, or publish any customer data outside of your own browser's local Tampermonkey storage — all customer names, phone numbers, and addresses are scraped live from pages you already have access to and never leave your machine.


License

Internal use only. This project is shared for reference; no warranty is provided, and no endorsement by DispatchTrack, Emitrr, or any client mentioned in usage is implied.
