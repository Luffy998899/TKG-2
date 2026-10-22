export interface ServiceGuide {
  slug: string;
  division: string;
  title: string;
  seoTitle: string;
  description: string;
  intro: string;
  serviceHeading: string;
  serviceIntro: string;
  quickChecks: string[];
  sections: { id: string; title: string; paragraphs: string[]; checklist?: string[] }[];
  faqs: { question: string; answer: string }[];
  relatedDivisions: string[];
}

/** Customer planning information grounded in the services we actually offer.
 * One distinct guide per division; city availability is confirmed per inquiry.
 * No invented rates, project results, licences or customer testimonials.
 */
export const serviceGuides: ServiceGuide[] = [
  {
    slug: 'security-camera-installation-planning', division: 'security-smart-home',
    title: 'Security camera installation: plan the coverage before the equipment',
    seoTitle: 'Security Camera Installation Planning Guide',
    description: 'Plan a home or business camera installation in BC: coverage, wired and wireless options, recording, access and the details needed for a useful quote.',
    intro: 'A camera count is not a coverage plan. Before choosing equipment, describe what you need to see, where it happens and how you want to review it. This checklist helps you prepare for a property consultation without guessing which camera bundle will fit.',
    serviceHeading: 'Plan your home security and camera installation',
    serviceIntro: 'Looking for home security in Surrey, Vancouver or elsewhere in the Lower Mainland and Fraser Valley? Start with your property and the areas you need covered. We confirm the installation scope and availability for your address.',
    quickChecks: ['List entrances, driveways and indoor areas that need coverage.', 'Tell us about existing cameras, cabling and internet access.', 'Separate equipment and installation costs from ongoing monitoring.'],
    sections: [
      { id: 'coverage', title: 'Start with what each camera needs to show', paragraphs: ['Write down the problem at each location: seeing a visitor at the front door, checking a driveway, or reviewing activity at a stockroom entrance. Wide coverage and a useful view of a specific doorway are different requirements.', 'Mention lighting changes, covered porches, obstructions and areas that should stay out of view. For a shared building, arrange permission and access with the responsible property contact before an installation is scheduled.'], checklist: ['Property type and number of floors', 'The area or event each camera should capture', 'Daytime and nighttime lighting', 'Mounting access and any building restrictions'] },
      { id: 'connection', title: 'Compare wiring, recording and everyday access', paragraphs: ['Wired and wireless camera options depend on the building, cable routes, power and network coverage. Existing wiring may be useful, but compatibility needs checking. A wireless connection does not by itself confirm how a camera will be powered.', 'Ask how recordings are stored, how long they remain available, who can access them and whether subscriptions are involved. Phone alerts, video recording and professional alarm monitoring are separate features; ask which ones are included in the proposed system.'] },
      { id: 'quote', title: 'Get an installation quote you can check', paragraphs: ['Send a simple list of locations and photos of the relevant areas. You do not need to publish access codes or passwords in an inquiry. The team can confirm whether a site visit is needed and discuss the equipment already installed.', 'The quote should identify equipment, installation work, recording arrangements and optional ongoing services. Ask what happens during an internet or power outage for the specific configuration being proposed, rather than assuming every device has the same backup.'] },
    ],
    faqs: [
      { question: 'Can my existing security cameras be reused?', answer: 'Possibly. Send the make and model, recorder details and what is working today. TKG checks compatibility and the condition of the existing installation before including reused equipment in a quote.' },
      { question: 'How much does security camera installation cost?', answer: 'The scope depends on camera locations, equipment, cable access, recording and any ongoing service. Send property details for an itemized quote. No standard package price is published here because it would not describe every property.' },
    ], relatedDivisions: ['telecommunications', 'business-services'],
  },
  {
    slug: 'compare-internet-plans-bc', division: 'telecommunications',
    title: 'How to compare internet plans in BC before you switch',
    seoTitle: 'Compare Internet Plans in BC: A Switching Guide',
    description: 'Compare internet plans by address, ongoing price, speed, equipment and contract terms. Prepare the right information before switching your BC connection.',
    intro: 'A promotional monthly price is only part of an internet offer. A useful comparison starts with the plans available at your exact address, then checks the ongoing bill, equipment and timing. Use this guide to prepare an inquiry for home or business internet.',
    serviceHeading: 'Compare internet plans beyond the promotional price',
    serviceIntro: 'If you are comparing internet providers in Surrey, Vancouver or Abbotsford, send the complete service address. Available plans can differ by property, so we check the address before discussing offers and switching dates.',
    quickChecks: ['Have your current monthly bill and promotion end date ready.', 'Compare download and upload needs, equipment and Wi-Fi coverage.', 'Ask for the ongoing price, contract term and activation details.'],
    sections: [
      { id: 'address', title: 'Check the full service address first', paragraphs: ['Include the unit number, street address, city and postal code. A nearby building having a particular connection does not establish availability at your own unit. Tell the team whether the service is for a home, a business or a move to a new address.', 'Describe how the connection will be used: video meetings, streaming, gaming, uploading work or running several devices at once. Mention weak Wi-Fi areas separately from a slow connection so the right problem is assessed.'] },
      { id: 'price', title: 'Compare the full bill and commitment', paragraphs: ['Ask for the promotional price and its duration, the regular monthly price afterwards, equipment charges and any activation or installation charge. Check which quoted amounts include taxes and which do not.', 'Keep your current bill separate from the new offer when comparing savings. A lower advertised number may refer to a different speed, a bundle or an eligibility condition. Confirm what applies to your address and household before deciding.'], checklist: ['Promotion duration and ongoing monthly price', 'Download and upload speeds offered', 'Equipment rental, ownership and return terms', 'Contract length and any cancellation conditions', 'Installation, activation and TV or phone bundle charges'] },
      { id: 'switching', title: 'Coordinate the switch before cancelling', paragraphs: ['Tell the team your preferred activation date, move-in date if relevant, and when the current promotion or contract ends. Confirm the new installation or activation arrangements and the steps required for the old account.', 'If you use a home phone number, ask about transfer options before closing that line. Keep instructions for returning old equipment and any final billing confirmation. TKG can discuss the available plans; the applicable provider terms still need to be checked for the offer you choose.'] },
    ],
    faqs: [
      { question: 'Can you compare plans for my exact address?', answer: 'Yes. The telecommunications inquiry starts with the service address so the team can check the available options. Include your unit number and say whether you need home or business service.' },
      { question: 'Will the new monthly price stay the same after the promotion?', answer: 'That depends on the offer. Ask for both the promotional and regular price, the dates they apply and the provider terms. Do not assume the introductory price lasts for the entire contract.' },
    ], relatedDivisions: ['security-smart-home', 'moving-delivery'],
  },
  {
    slug: 'vehicle-sourcing-car-buying-assistance', division: 'automotive',
    title: 'Vehicle sourcing and car buying assistance: prepare a useful brief',
    seoTitle: 'Vehicle Sourcing & Car Buying Assistance Guide',
    description: 'Prepare a vehicle sourcing brief with your budget, model preferences and timeline. Understand TKG assistance and the licensed selling dealership’s role.',
    intro: 'Car buying assistance is more useful when your requirements are clear. TKG Ventures searches its dealership network and introduces you to the licensed dealer selling a matching vehicle. This guide explains what to send and what to confirm when reviewing the shortlist.',
    serviceHeading: 'Car buying assistance with a clear vehicle brief',
    serviceIntro: 'Our automotive service helps with vehicle sourcing and dealer introductions for customers in BC. Tell us your budget, preferred vehicle and timeline; we confirm the search scope and discuss suitable options from dealership partners.',
    quickChecks: ['Separate must-have features from preferences you can change.', 'State whether your budget is a vehicle price or a total purchase limit.', 'Review the vehicle details and selling dealership before proceeding.'],
    sections: [
      { id: 'brief', title: 'Write the requirements before searching', paragraphs: ['Start with the type of vehicle and the work it needs to do. A specific make and model is useful if you already know it; otherwise describe the seating, cargo space and driving needs that matter. Include the year range, acceptable mileage and your timing.', 'Identify two or three non-negotiable requirements and the features that would simply be nice to have. That makes it easier to judge a real match instead of receiving a long list of loosely related listings.'], checklist: ['Make, model or vehicle type', 'Year range, mileage and important features', 'Budget and whether it includes purchase-related charges', 'Preferred timing and flexibility', 'A vehicle to sell or trade, if relevant'] },
      { id: 'shortlist', title: 'Check each shortlisted vehicle on its own facts', paragraphs: ['Compare the specific vehicle, not just the model name. Ask for the year, mileage, condition information, advertised price and the name of the selling dealership. Availability can change, so confirm that the vehicle is still available before arranging a visit.', 'If you want a pre-purchase inspection, discuss coordination before committing. Inspection findings, vehicle records and the selling dealer’s documents help you ask better questions; an introduction alone does not establish the condition of a vehicle.'] },
      { id: 'roles', title: 'Know who handles the transaction', paragraphs: ['TKG provides sourcing and referral assistance. It is not a licensed dealership and does not hold vehicle inventory. The licensed selling dealership handles the vehicle sale and any applicable dealership transactions, including financing arrangements.', 'Ask which work TKG will coordinate, who you will deal with at the dealership and whether any service charges apply. Keep the dealer’s purchase documents and terms separate from the sourcing brief so the responsibilities are clear.'] },
    ],
    faqs: [
      { question: 'Am I buying the vehicle directly from TKG Ventures?', answer: 'No. TKG provides vehicle sourcing and referrals. You complete the purchase with the licensed dealership selling the vehicle. TKG does not hold inventory or provide vehicle financing itself.' },
      { question: 'Can I ask for alternatives after the first shortlist?', answer: 'Yes. Tell the team which requirements an option missed and which preferences can change. A clearer budget, mileage range or timeline helps refine the search through the dealership network.' },
    ], relatedDivisions: ['business-services', 'telecommunications'],
  },
  {
    slug: 'realtor-referral-preparation-bc', division: 'real-estate',
    title: 'Realtor referrals in BC: what to prepare before an introduction',
    seoTitle: 'Realtor Referrals in BC: Preparation Checklist',
    description: 'Prepare for a realtor introduction in BC with your area, property type and timeline. Understand the roles of TKG and the licensed representative.',
    intro: 'A useful realtor referral starts with the kind of property help you need. TKG makes introductions to licensed real estate representatives. Preparing a short brief helps the conversation focus on your area, property type and next steps.',
    serviceHeading: 'Find the right conversation with a licensed realtor',
    serviceIntro: 'Planning a property purchase or sale in the Lower Mainland or Fraser Valley? Share the area, property type and your timeline. Our real estate division helps arrange a relevant introduction; regulated real estate services are provided by a licensed representative.',
    quickChecks: ['Say whether you are buying, selling or still exploring.', 'List the areas, property type and timing that matter.', 'Confirm the representative’s role and terms before engaging them.'],
    sections: [
      { id: 'purpose', title: 'Explain what you need from the introduction', paragraphs: ['Tell us whether you are looking to buy, sell, or understand the process before making a decision. Include the communities you are considering and the property type, such as a condo, townhouse or detached home.', 'If you are selling, provide a general description and the area. If you are buying, list the features that determine your search and the preferences you can change. You do not need to send sensitive financial documents in the initial referral inquiry.'] },
      { id: 'questions', title: 'Prepare questions for the representative', paragraphs: ['Ask about experience with your property type and area, how communication will work and what information is needed before the next step. A referral gives you a conversation; it does not decide which representative you should engage.', 'Confirm the scope of any proposed services and ask the licensed representative to explain the applicable agreements, fees and disclosures before you commit. Property valuation, representation and transaction advice belong with the appropriately licensed professional.'], checklist: ['The areas and property types they work with', 'Who will be your main contact', 'The proposed work and expected next steps', 'Agreements, fees and disclosures to review', 'How your information will be shared'] },
      { id: 'timing', title: 'Coordinate the practical work around the property', paragraphs: ['Share your approximate timeline and whether it depends on another sale, a tenancy change or a move. A flexible target and a fixed deadline call for different planning conversations.', 'Once your plans become clearer, you may also need a small move, furniture delivery or a move-out clean. These are separate services and should have their own written scope and dates rather than being assumed to form part of a realtor introduction.'] },
    ],
    faqs: [
      { question: 'Does TKG Ventures act as my real estate representative?', answer: 'TKG arranges introductions and helps you get oriented. Regulated real estate services are carried out by a licensed representative. Confirm representation and any service agreement directly with that professional.' },
      { question: 'Can I ask for a referral before I have a fixed moving date?', answer: 'Yes. Tell the team that you are exploring and provide the area and property type. A provisional timeline is useful, and you can update it when your plans are firmer.' },
    ], relatedDivisions: ['moving-delivery', 'cleaning'],
  },
  {
    slug: 'small-moves-furniture-delivery-checklist', division: 'moving-delivery',
    title: 'Small moves and furniture delivery: a booking checklist',
    seoTitle: 'Small Moves & Furniture Delivery Checklist',
    description: 'Prepare a small move or furniture delivery in BC. Check item sizes, access, pickup details and timing before requesting your moving quote.',
    intro: 'A small move can still be difficult to quote when access and load details are missing. Whether it is a studio move, a couch or a Marketplace pickup, this checklist helps you send the information the moving team needs before the truck is booked.',
    serviceHeading: 'Small moves, single items and furniture delivery',
    serviceIntro: 'Planning a small move in Vancouver, Surrey or elsewhere in the Lower Mainland and Fraser Valley? Send both addresses and an item list so we can check the load, route and access. Our service is sized for small moves and deliveries.',
    quickChecks: ['Send item photos and dimensions for bulky furniture.', 'Describe stairs, elevators and parking at both addresses.', 'Confirm the seller’s pickup window before booking a delivery.'],
    sections: [
      { id: 'load', title: 'Describe the whole load, including the awkward items', paragraphs: ['List furniture, appliances and the approximate box count. Include dimensions for bulky pieces and mention items that cannot be taken apart. Photos help distinguish a few compact items from a load that needs a different vehicle or crew.', 'TKG handles single items, partial moves, studios and one-bedroom moves. A larger household may need a larger moving crew. Say what is moving before choosing a service rather than assuming a small-move booking will fit every load.'] },
      { id: 'access', title: 'Check access at pickup and delivery', paragraphs: ['The truck journey is only one part of the job. Stairs, narrow doorways, elevator reservations and the distance from parking to the entrance all affect the work. Describe both ends, even if only one address is difficult.', 'For an apartment building, ask the property contact about loading access and an elevator booking. Tell the team about any time restrictions before agreeing a slot.'], checklist: ['Pickup and delivery addresses, including unit numbers', 'Floor level, stairs and elevator access at both ends', 'Parking or loading area and walking distance', 'Doorway constraints for large furniture', 'Preferred date and any fixed access window'] },
      { id: 'delivery', title: 'Confirm a Marketplace or store pickup before booking', paragraphs: ['Send the listing or item details, the seller’s contact arrangements and the agreed collection time. Confirm that the item will be ready and explain any loading assistance available at pickup.', 'Ask what is included in the quote: transport, carrying, any agreed disassembly and any special handling. Packing boxes and preparation are your responsibility unless arranged in the quote. Same-day availability is checked for the actual route and timing.'] },
    ],
    faqs: [
      { question: 'Can you move just one sofa or appliance?', answer: 'Yes. Single-item furniture and appliance delivery is part of the service. Send a photo, dimensions, both addresses and access details so the team can confirm suitability and quote the job.' },
      { question: 'What affects the price of a small move?', answer: 'The load, distance, stairs, elevator or loading restrictions, timing and any agreed extra work affect the quote. Send the full scope first; a photo and both addresses are more useful than an item count alone.' },
    ], relatedDivisions: ['cleaning', 'telecommunications'],
  },
  {
    slug: 'move-out-deep-cleaning-checklist', division: 'cleaning',
    title: 'Move-out cleaning or a deep clean? Build the right checklist',
    seoTitle: 'Move-Out & Deep Cleaning Checklist',
    description: 'Plan a move-out clean, deep clean or commercial cleaning visit. Define rooms, extras, access and timing so your cleaning quote matches the work.',
    intro: 'A regular house clean, a deep clean and a move-out clean need different scopes. The useful question is what must be cleaned and how the result will be checked. This guide helps you prepare a written checklist and request a quote that reflects your space.',
    serviceHeading: 'House, move-out and commercial cleaning services',
    serviceIntro: 'Need cleaning services in Surrey, Abbotsford or elsewhere in the Lower Mainland and Fraser Valley? Tell us whether the space is a home, rental or workplace, and whether you need a recurring visit, deep clean or move-out clean. Availability is confirmed for your address.',
    quickChecks: ['List rooms and areas needing extra attention.', 'Confirm appliances, inside cupboards and any specialist work.', 'Give the size, condition, access instructions and deadline.'],
    sections: [
      { id: 'scope', title: 'Choose the scope before comparing quotes', paragraphs: ['Recurring residential cleaning maintains a space over time. A deep clean gives attention to areas beyond a maintenance visit. A move-out clean is planned around an empty or partly emptied property and the handover requirements you provide.', 'List kitchens, bathrooms, living areas and any specific appliance or cupboard work. Do not assume carpet cleaning, exterior windows or specialist restoration is included just because a service is called a deep clean; ask for each extra to be confirmed.'], checklist: ['Number of bedrooms, bathrooms and approximate floor area', 'Kitchen appliances and cupboards to clean inside', 'High-dust, renovation-dust or neglected areas', 'Any carpet, glass or other specialist work to discuss', 'The checklist or handover requirements you want followed'] },
      { id: 'timing', title: 'Plan the timing and access', paragraphs: ['Say whether furniture and belongings will still be present. For a move-out, explain when the movers finish and when you need the clean completed. Leave time to check the agreed work before your handover.', 'Provide access arrangements and mention pets, fragrance sensitivities, surface-care requirements or preferred products. For commercial cleaning, explain operating hours, restricted areas and whether the work is one-off or recurring.'] },
      { id: 'quote', title: 'Understand what changes the price and duration', paragraphs: ['Floor area alone does not describe the job. Room count, condition, appliance interiors, renovation dust, access and the agreed checklist all affect the work. Photos of the areas needing attention help the team assess the scope.', 'Ask for the included tasks and any exclusions in writing. Confirm the expected timing when the scope is agreed rather than relying on a generic duration. A cleaning booking does not guarantee a landlord’s deposit decision or replace your own handover arrangements.'] },
    ],
    faqs: [
      { question: 'How much does move-out cleaning cost?', answer: 'The quote depends on the size and condition of the property, the checklist and any agreed extras. Send room counts, photos and your deadline for a scoped quote. TKG does not publish a single rate that would fit every move-out.' },
      { question: 'Does a move-out clean include carpet cleaning?', answer: 'Ask for carpet cleaning to be confirmed separately in the written scope. The same applies to appliance interiors, exterior glass and other specialist work. A service label alone does not establish which extras are included.' },
    ], relatedDivisions: ['moving-delivery', 'staffing'],
  },
  {
    slug: 'temporary-staffing-general-labour-brief', division: 'staffing',
    title: 'Temporary staffing and general labour: write a clear shift brief',
    seoTitle: 'Temporary Staffing & General Labour Checklist',
    description: 'Prepare a staffing request for cleaning crews, general labour or warehouse support: duties, headcount, shifts, site access and supervision.',
    intro: 'A staffing request needs more than a headcount and a start time. A clear shift brief explains the actual work, the site and who will supervise. Use this checklist when asking TKG for temporary cover or an ongoing placement.',
    serviceHeading: 'Temporary staffing for the work your site needs',
    serviceIntro: 'Looking for a staffing agency for a Surrey site or another location in the Lower Mainland and Fraser Valley? Describe the duties, hours and number of people. We discuss cleaning staff, general labour, warehouse help and event support based on the role and availability.',
    quickChecks: ['Describe duties and required experience, not just a job title.', 'Provide headcount, shift times and the site address.', 'Name the on-site supervisor and explain access or clearances.'],
    sections: [
      { id: 'duties', title: 'Describe the shift in practical terms', paragraphs: ['Explain what people will do during the shift: cleaning rooms, loading, warehouse work or event support. Include the pace, relevant equipment and any physical requirements that need discussion. A familiar title can mean very different work at two sites.', 'State any certificates, training, clearances or site induction requirements before a placement is considered. Tell the team what equipment and instructions the site provides so responsibilities can be clarified.'] },
      { id: 'schedule', title: 'Make the schedule and reporting arrangements clear', paragraphs: ['Provide the dates, start and finish times, headcount and whether this is a single shift, short-term cover or a recurring rota. Say which details are fixed and whether a partial fill would help.', 'Identify the on-site supervisor and the contact for access problems or changes. The brief should explain where staff report, how attendance is recorded and how changes to the agreed hours will be communicated.'], checklist: ['Duties, experience and any required credentials', 'Number of people and confirmed shift times', 'Site address, reporting point and access instructions', 'Supervisor and an arrival contact', 'Equipment, induction and attendance arrangements'] },
      { id: 'service', title: 'Choose staff supply or a managed service', paragraphs: ['With a supply placement, your business supervises the people on site. If you want TKG to scope, manage and check a cleaning result instead, ask the Cleaning division for a service quote. Those are different arrangements even if the practical work looks similar.', 'Ask about availability, the agreed rate, cover arrangements and what happens when the scope or shift changes. Short-notice requests depend on the role and people available; the team confirms what can actually be filled before you rely on the booking.'] },
    ],
    faqs: [
      { question: 'Can I book temporary staff for one shift?', answer: 'Yes. Single shifts, short-term cover and recurring placements are normal inquiries. Tell the team the role, hours, headcount and site details so availability and the quote can be confirmed.' },
      { question: 'Is staffing the same as booking a cleaning service?', answer: 'No. For a staffing placement, your team supervises the people supplied. A managed cleaning service has an agreed cleaning scope and result. Choose the arrangement that matches who should organize and check the work.' },
    ], relatedDivisions: ['cleaning', 'moving-delivery'],
  },
  {
    slug: 'lead-generation-business-marketing-brief', division: 'business-services',
    title: 'Lead generation and business marketing: define the brief first',
    seoTitle: 'Lead Generation & Business Marketing Brief Guide',
    description: 'Prepare a business marketing or lead generation brief with your audience, offer, qualification criteria, follow-up process and measurable outcomes.',
    intro: 'More inquiries only help when they match the business and get followed up. Before discussing a marketing campaign, define the customer, the offer and what makes an inquiry useful. This guide turns a broad request for more leads into a practical conversation.',
    serviceHeading: 'Lead generation and marketing with a defined goal',
    serviceIntro: 'Need business marketing or lead generation support in Vancouver, Surrey or the wider Lower Mainland and Fraser Valley? Start with the customers you want to reach, the service you sell and how you handle inquiries. We discuss the work and scope around those requirements.',
    quickChecks: ['Define the customer, service area and offer.', 'Agree what counts as a qualified inquiry.', 'Identify who follows up and how results will be measured.'],
    sections: [
      { id: 'audience', title: 'Define the customer and the offer', paragraphs: ['Describe the type of customer you can serve well and the places where you can actually deliver the service. Include the need that usually brings someone to you and the offer they should ask about. A campaign covering every possible customer makes it harder to judge a useful response.', 'Share the current website or landing page and any existing marketing. Point out the services you want to grow and any work you cannot take on. Existing customer questions can show what information the page needs before more traffic is sent to it.'] },
      { id: 'qualification', title: 'Agree what a qualified inquiry means', paragraphs: ['Decide what information your team needs to assess a lead: the required service, location, timing or other relevant details. Distinguish a contact form submission from a qualified conversation, appointment, quote and completed sale.', 'Explain where inquiries should arrive and who owns the next step. A missed call or an unanswered form cannot be fixed by counting it as more reach. Ask how lead sources and follow-up outcomes will be recorded.'], checklist: ['Target customer and actual service area', 'Offer and landing page', 'Qualification criteria and exclusions', 'The person responsible for follow-up', 'How inquiries, quotes and sales will be recorded'] },
      { id: 'measurement', title: 'Set a scope and measure the outcomes', paragraphs: ['Separate the work to prepare the website, the ongoing campaign work and any advertising budget. Ask which assets and accounts are involved, what reporting you will receive and what your team needs to supply.', 'Review qualified inquiries and sales outcomes alongside reach and clicks. These measures answer different questions. TKG can discuss marketing and lead generation support, but no fixed lead volume, search position or return is promised by this guide.'] },
    ],
    faqs: [
      { question: 'What should I send for a lead generation inquiry?', answer: 'Send your business website, target customer, service area, offer and the outcome you want to improve. Explain how current leads arrive and who follows up. The team can then discuss a relevant scope.' },
      { question: 'Can you guarantee a number of leads or sales?', answer: 'A useful proposal needs the offer, audience, budget and follow-up process first. This page makes no guaranteed lead or sales claim. Agree the scope, reporting and success measures before starting work.' },
    ], relatedDivisions: ['staffing', 'telecommunications'],
  },
];

export const guidePath = (slug: string) => `/guides/${slug}`;
export const getServiceGuide = (slug: string) => serviceGuides.find((guide) => guide.slug === slug);
export const guideForDivision = (division: string) => serviceGuides.find((guide) => guide.division === division);
