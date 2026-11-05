import { format } from 'date-fns';

// PDF Configuration
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 20;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const AMBER_RGB: [number, number, number] = [245, 158, 11];
const DARK_SLATE_RGB: [number, number, number] = [30, 41, 59];
const WHITE_RGB: [number, number, number] = [255, 255, 255];
const GRAY_RGB: [number, number, number] = [100, 116, 139];
const LIGHT_GRAY_RGB: [number, number, number] = [241, 245, 249];

interface SectionContent {
  title: string;
  pageNumber: number;
}

export async function generateOrderGuideManualPDF(): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  let yPos = MARGIN;
  let currentPage = 1;
  const tableOfContents: SectionContent[] = [];

  // Helper functions
  const addPage = () => {
    doc.addPage();
    currentPage++;
    yPos = MARGIN;
    addFooter();
  };

  const checkPageBreak = (height: number) => {
    if (yPos + height > PAGE_HEIGHT - 30) {
      addPage();
    }
  };

  const addFooter = () => {
    doc.setFontSize(8);
    doc.setTextColor(...GRAY_RGB);
    doc.text(`Page ${currentPage}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 10, { align: 'center' });
    doc.text('Field Sales Order Entry Guide', MARGIN, PAGE_HEIGHT - 10);
    doc.text(format(new Date(), 'MMM yyyy'), PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 10, { align: 'right' });
  };

  const drawSectionHeader = (text: string, fontSize: number = 16, recordTOC: boolean = true) => {
    checkPageBreak(20);
    if (recordTOC) {
      tableOfContents.push({ title: text, pageNumber: currentPage });
    }
    doc.setFontSize(fontSize);
    doc.setTextColor(...AMBER_RGB);
    doc.setFont('helvetica', 'bold');
    doc.text(text, MARGIN, yPos);
    yPos += 3;
    doc.setDrawColor(...AMBER_RGB);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, yPos, PAGE_WIDTH - MARGIN, yPos);
    yPos += 10;
    doc.setTextColor(...DARK_SLATE_RGB);
    doc.setFont('helvetica', 'normal');
  };

  const drawSubHeader = (text: string) => {
    checkPageBreak(12);
    doc.setFontSize(12);
    doc.setTextColor(...DARK_SLATE_RGB);
    doc.setFont('helvetica', 'bold');
    doc.text(text, MARGIN, yPos);
    yPos += 7;
    doc.setFont('helvetica', 'normal');
  };

  const drawParagraph = (text: string, indent: number = 0) => {
    doc.setFontSize(10);
    doc.setTextColor(...DARK_SLATE_RGB);
    const lines = doc.splitTextToSize(text, CONTENT_WIDTH - indent);
    lines.forEach((line: string) => {
      checkPageBreak(6);
      doc.text(line, MARGIN + indent, yPos);
      yPos += 5;
    });
    yPos += 2;
  };

  const drawBullet = (text: string, indent: number = 5) => {
    checkPageBreak(8);
    doc.setFontSize(10);
    doc.setTextColor(...DARK_SLATE_RGB);
    doc.text('•', MARGIN + indent, yPos);
    const lines = doc.splitTextToSize(text, CONTENT_WIDTH - indent - 8);
    doc.text(lines, MARGIN + indent + 5, yPos);
    yPos += lines.length * 5 + 2;
  };

  const drawNumberedStep = (number: number, text: string, indent: number = 0) => {
    checkPageBreak(8);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...AMBER_RGB);
    doc.text(`${number}.`, MARGIN + indent, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK_SLATE_RGB);
    const lines = doc.splitTextToSize(text, CONTENT_WIDTH - indent - 10);
    doc.text(lines, MARGIN + indent + 8, yPos);
    yPos += lines.length * 5 + 3;
  };

  const drawTipBox = (text: string) => {
    checkPageBreak(25);
    doc.setFillColor(...LIGHT_GRAY_RGB);
    const lines = doc.splitTextToSize(text, CONTENT_WIDTH - 20);
    const boxHeight = lines.length * 5 + 12;
    doc.roundedRect(MARGIN, yPos - 2, CONTENT_WIDTH, boxHeight, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...AMBER_RGB);
    doc.text('💡 TIP:', MARGIN + 5, yPos + 5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK_SLATE_RGB);
    doc.text(lines, MARGIN + 25, yPos + 5);
    yPos += boxHeight + 5;
  };

  // ==================== COVER PAGE ====================
  doc.setFillColor(...DARK_SLATE_RGB);
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F');

  // Title
  doc.setTextColor(...WHITE_RGB);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text('Field Sales', PAGE_WIDTH / 2, 80, { align: 'center' });
  doc.text('Order Entry Guide', PAGE_WIDTH / 2, 95, { align: 'center' });

  // Subtitle
  doc.setFontSize(16);
  doc.setTextColor(...AMBER_RGB);
  doc.text('Complete User Manual', PAGE_WIDTH / 2, 120, { align: 'center' });
  doc.text('for Sales Representatives', PAGE_WIDTH / 2, 130, { align: 'center' });

  // Version info
  doc.setFontSize(12);
  doc.setTextColor(...WHITE_RGB);
  doc.text(`Version 1.0`, PAGE_WIDTH / 2, 180, { align: 'center' });
  doc.text(format(new Date(), 'MMMM yyyy'), PAGE_WIDTH / 2, 192, { align: 'center' });

  // Footer
  doc.setFontSize(10);
  doc.setTextColor(...GRAY_RGB);
  doc.text('Powered by Field Sales Navigator', PAGE_WIDTH / 2, 270, { align: 'center' });

  // ==================== TABLE OF CONTENTS (placeholder page) ====================
  addPage();
  const tocPageNumber = currentPage;
  doc.setFontSize(20);
  doc.setTextColor(...AMBER_RGB);
  doc.setFont('helvetica', 'bold');
  doc.text('Table of Contents', MARGIN, yPos);
  yPos += 15;
  // We'll come back to fill this after generating all content

  // ==================== SECTION 1: GETTING STARTED ====================
  addPage();
  drawSectionHeader('1. Getting Started');

  drawSubHeader('Logging In');
  drawParagraph('Open the Field Sales Navigator app on your device. Enter your registered mobile number or email address along with your password. Tap "Login" to access your dashboard.');
  yPos += 3;

  drawSubHeader('Marking Attendance');
  drawParagraph('Before you can start taking orders, you may need to mark your attendance for the day:');
  drawNumberedStep(1, 'Go to the Attendance section from the dashboard');
  drawNumberedStep(2, 'Allow camera and location permissions when prompted');
  drawNumberedStep(3, 'Take a selfie to verify your identity');
  drawNumberedStep(4, 'Your check-in will be recorded with timestamp and location');
  yPos += 3;

  drawTipBox('If attendance is mandatory, you won\'t be able to access order entry until you\'ve checked in.');

  drawSubHeader('Understanding the Dashboard');
  drawParagraph('The dashboard shows your daily targets, pending visits, and quick actions. Use the bottom navigation to access different sections like My Visits, Orders, and Analytics.');

  // ==================== SECTION 2: ACCESSING ORDER ENTRY ====================
  addPage();
  drawSectionHeader('2. Accessing Order Entry');

  drawSubHeader('From My Visits');
  drawParagraph('The primary way to enter orders is through the My Visits page:');
  drawNumberedStep(1, 'Navigate to "My Visits" from the dashboard or bottom navigation');
  drawNumberedStep(2, 'View your beat plan for the day with all scheduled retailers');
  drawNumberedStep(3, 'Tap on any retailer card to open the order entry screen');
  drawNumberedStep(4, 'The retailer name and visit details will be automatically populated');
  yPos += 5;

  drawSubHeader('Phone Orders');
  drawParagraph('For orders received via phone call:');
  drawNumberedStep(1, 'Look for the "Phone Order" option on the My Visits page');
  drawNumberedStep(2, 'Select the retailer from the search');
  drawNumberedStep(3, 'The order will be marked as a phone order in reports');
  yPos += 5;

  drawTipBox('Phone orders don\'t require GPS verification as you\'re not physically at the retailer location.');

  // ==================== SECTION 3: ORDER ENTRY SCREEN OVERVIEW ====================
  addPage();
  drawSectionHeader('3. Order Entry Screen Overview');

  drawSubHeader('Header Section');
  drawBullet('Retailer Name: Displayed at the top for confirmation');
  drawBullet('Connection Status: Shows online/offline indicator');
  drawBullet('Location Status: GPS tracking and distance from retailer');
  drawBullet('Time Spent: Duration of your visit');
  yPos += 3;

  drawSubHeader('Mode Selection Tabs');
  drawParagraph('The order entry screen has multiple modes accessible via tabs:');
  drawBullet('Table View: Traditional row-by-row order entry (default)');
  drawBullet('Grid View: Visual product cards for quick ordering');
  drawBullet('Returns: Record product returns from the retailer');
  drawBullet('No Order: Mark visit as unproductive with reason');
  drawBullet('Competition: Capture competitor information');
  yPos += 3;

  drawSubHeader('AI Tools');
  drawParagraph('Powerful AI-assisted features to speed up ordering:');
  drawBullet('Voice Order: Speak your order in natural language');
  drawBullet('Smart Basket: AI-suggested products based on purchase history');
  drawBullet('AI Stock Capture: Take photos to record closing stock');
  yPos += 3;

  drawSubHeader('Cart Summary');
  drawParagraph('At the bottom of the screen, you\'ll see the cart summary showing total items and order value. Tap the cart icon to review and modify your order.');

  // ==================== SECTION 4: TABLE VIEW ORDER ENTRY ====================
  addPage();
  drawSectionHeader('4. Table View Order Entry');

  drawParagraph('Table View is the default and most commonly used mode for entering orders. It provides a structured, form-based approach:');
  yPos += 5;

  drawSubHeader('Step-by-Step Process');
  drawNumberedStep(1, 'Tap on the "Select Product" dropdown to see the product list');
  drawNumberedStep(2, 'Type in the search box to filter products by name');
  drawNumberedStep(3, 'Select the desired product from the dropdown');
  drawNumberedStep(4, 'If the product has variants (sizes/packs), a second dropdown appears');
  drawNumberedStep(5, 'Choose the specific variant you want to order');
  drawNumberedStep(6, 'Enter the quantity in the Qty field');
  drawNumberedStep(7, 'Select the unit (KG or Grams) if applicable');
  drawNumberedStep(8, 'The rate and total are calculated automatically');
  drawNumberedStep(9, 'Click the "+" button to add another product row');
  drawNumberedStep(10, 'Review and click "Add to Cart" when done');
  yPos += 5;

  drawSubHeader('Understanding the Columns');
  drawBullet('Product: The base product name');
  drawBullet('Variant: Specific SKU or pack size');
  drawBullet('Qty: Number of units to order');
  drawBullet('Unit: KG, Grams, Pieces, etc.');
  drawBullet('Rate: Price per unit');
  drawBullet('Total: Calculated amount (Qty × Rate)');
  yPos += 3;

  drawSubHeader('Removing Items');
  drawParagraph('Click the "X" button on any row to remove that product from the current entry. Already added cart items can be modified from the cart page.');

  drawTipBox('Products with schemes show a gift icon. Tap it to see scheme details before ordering.');

  // ==================== SECTION 5: GRID VIEW ORDER ENTRY ====================
  addPage();
  drawSectionHeader('5. Grid View Order Entry');

  drawParagraph('Grid View provides a visual, card-based interface ideal for quick ordering when you\'re familiar with the product range:');
  yPos += 5;

  drawSubHeader('Category Navigation');
  drawParagraph('At the top, you\'ll see category chips/tabs:');
  drawBullet('"All" shows every product');
  drawBullet('Category names filter to specific product groups');
  drawBullet('Scroll horizontally to see more categories');
  yPos += 3;

  drawSubHeader('Product Cards');
  drawParagraph('Each product is displayed as a card showing:');
  drawBullet('Product name and variant information');
  drawBullet('Price per unit');
  drawBullet('Quantity controls (+/- buttons)');
  drawBullet('Star icon for focused/priority products');
  drawBullet('Gift icon if schemes are available');
  yPos += 3;

  drawSubHeader('Quick Add');
  drawNumberedStep(1, 'Find the product you want to order');
  drawNumberedStep(2, 'Use the "+" button to increase quantity');
  drawNumberedStep(3, 'Use the "-" button to decrease quantity');
  drawNumberedStep(4, 'The cart updates automatically');
  yPos += 3;

  drawSubHeader('Expanding Variants');
  drawParagraph('For products with multiple variants, tap anywhere on the product card to expand and see all available options. Select the specific variant you want to order.');

  drawTipBox('Focused products (marked with a star) are priority items your company wants you to push. Try to include these in every order!');

  // ==================== SECTION 6: SCHEMES & OFFERS ====================
  addPage();
  drawSectionHeader('6. Understanding Schemes & Offers');

  drawParagraph('The app automatically applies eligible schemes to your orders. Here\'s how to work with them:');
  yPos += 5;

  drawSubHeader('Types of Schemes');
  drawBullet('BOGO (Buy One Get One): Order X units, get Y units free');
  drawBullet('Percentage Discount: Get X% off when ordering minimum quantity');
  drawBullet('Value-Based: Discount when order exceeds certain amount');
  drawBullet('Tiered Schemes: Better discounts at higher quantities');
  yPos += 3;

  drawSubHeader('Viewing Scheme Details');
  drawNumberedStep(1, 'Look for the gift icon (🎁) next to products with schemes');
  drawNumberedStep(2, 'Tap the gift icon to open the scheme details popup');
  drawNumberedStep(3, 'Review the conditions (minimum quantity, validity, etc.)');
  drawNumberedStep(4, 'Close the popup and enter the required quantity to avail');
  yPos += 3;

  drawSubHeader('Auto-Applied Schemes');
  drawParagraph('When you meet the scheme conditions, the discount is automatically calculated and shown in the cart. You don\'t need to do anything extra - just order the qualifying quantity.');
  yPos += 3;

  drawSubHeader('Viewing Applied Discounts');
  drawParagraph('On the cart page, you\'ll see a breakdown of:');
  drawBullet('Subtotal (before discounts)');
  drawBullet('Scheme discounts applied');
  drawBullet('Final total (after discounts)');

  // ==================== SECTION 7: AI-POWERED FEATURES ====================
  addPage();
  drawSectionHeader('7. AI-Powered Features');

  drawSubHeader('Voice Order Assistant');
  drawParagraph('Speak your order in natural language and let AI convert it to cart items:');
  drawNumberedStep(1, 'Tap the microphone icon in the order entry screen');
  drawNumberedStep(2, 'Allow microphone permission if prompted');
  drawNumberedStep(3, 'Speak clearly: "Add 5 KG of Basmati Rice and 2 packets of Atta"');
  drawNumberedStep(4, 'Wait for processing - products will be matched automatically');
  drawNumberedStep(5, 'Review the suggested items and confirm');
  yPos += 3;

  drawTipBox('Voice ordering works best when you mention product names clearly with quantities and units.');
  yPos += 3;

  drawSubHeader('Smart Basket');
  drawParagraph('AI-recommended products based on the retailer\'s purchase history:');
  drawNumberedStep(1, 'Look for the "Smart Basket" or sparkle icon');
  drawNumberedStep(2, 'Tap to see AI-generated recommendations');
  drawNumberedStep(3, 'Products are suggested based on past orders');
  drawNumberedStep(4, 'One-tap add to include recommended items');
  yPos += 3;

  drawSubHeader('AI Stock Capture');
  drawParagraph('Use your camera to automatically detect and record closing stock:');
  drawNumberedStep(1, 'Tap the camera icon for AI Stock Capture');
  drawNumberedStep(2, 'Point your camera at the retailer\'s shelf');
  drawNumberedStep(3, 'Take a clear photo of the products');
  drawNumberedStep(4, 'AI will identify products and estimate quantities');
  drawNumberedStep(5, 'Review and adjust the detected stock levels');

  // ==================== SECTION 8: RETURN STOCK ENTRY ====================
  addPage();
  drawSectionHeader('8. Return Stock Entry');

  drawParagraph('When a retailer wants to return products, use the Returns mode:');
  yPos += 5;

  drawSubHeader('Accessing Returns Mode');
  drawNumberedStep(1, 'From the order entry screen, tap the "Returns" tab');
  drawNumberedStep(2, 'The interface changes to return entry mode');
  yPos += 3;

  drawSubHeader('Recording Return Items');
  drawNumberedStep(1, 'Select the product being returned from the dropdown');
  drawNumberedStep(2, 'Choose the variant if applicable');
  drawNumberedStep(3, 'Enter the return quantity');
  drawNumberedStep(4, 'Select a return reason (damaged, expired, wrong item, etc.)');
  drawNumberedStep(5, 'Add any additional notes if required');
  drawNumberedStep(6, 'Repeat for multiple return items');
  yPos += 3;

  drawSubHeader('Submitting Returns');
  drawParagraph('After entering all return items, tap "Submit Returns" to record the return request. Returns are typically subject to approval by your manager.');

  drawTipBox('Take photos of damaged or defective products as evidence for the return claim.');

  // ==================== SECTION 9: NO ORDER ENTRY ====================
  addPage();
  drawSectionHeader('9. No Order Entry (Unproductive Visit)');

  drawParagraph('Sometimes you won\'t be able to take an order. Use the "No Order" mode to record why:');
  yPos += 5;

  drawSubHeader('Available Reasons');
  drawBullet('Over Stocked: Retailer has sufficient inventory');
  drawBullet('Owner Not Available: Shop is open but decision maker absent');
  drawBullet('Store Closed: Shop is temporarily closed');
  drawBullet('Permanently Closed: Business has shut down');
  drawBullet('Credit Issue: Pending payments preventing new orders');
  drawBullet('Other: Custom reason (specify in notes)');
  yPos += 3;

  drawSubHeader('Submitting No Order');
  drawNumberedStep(1, 'Tap the "No Order" tab in order entry');
  drawNumberedStep(2, 'Select the appropriate reason from the list');
  drawNumberedStep(3, 'Add any additional notes for context');
  drawNumberedStep(4, 'Tap "Submit" to record the unproductive visit');
  yPos += 3;

  drawParagraph('The visit is still recorded with your GPS location and timestamp, contributing to your visit count even though no order was placed.');

  drawTipBox('If the store is "Permanently Closed", consider informing your manager to update the beat plan.');

  // ==================== SECTION 10: COMPETITION DATA ====================
  addPage();
  drawSectionHeader('10. Competition Data Entry');

  drawParagraph('Capture valuable competitive intelligence during your retailer visits:');
  yPos += 5;

  drawSubHeader('Recording Competitor Information');
  drawNumberedStep(1, 'Tap the "Competition" tab in order entry');
  drawNumberedStep(2, 'Select or enter the competitor brand name');
  drawNumberedStep(3, 'Record observed products and their prices');
  drawNumberedStep(4, 'Note any schemes or offers they\'re running');
  drawNumberedStep(5, 'Estimate their shelf space or stock levels');
  yPos += 3;

  drawSubHeader('Photos and Notes');
  drawBullet('Take photos of competitor displays for visual evidence');
  drawBullet('Capture promotional materials or scheme posters');
  drawBullet('Add detailed notes about retailer feedback on competitors');
  yPos += 3;

  drawParagraph('This data helps your company understand market dynamics and adjust strategies accordingly.');

  // ==================== SECTION 11: CART MANAGEMENT ====================
  addPage();
  drawSectionHeader('11. Viewing and Managing Cart');

  drawSubHeader('Accessing the Cart');
  drawParagraph('Tap the shopping cart icon at the bottom of the order entry screen. You\'ll see the total items count on the icon badge.');
  yPos += 3;

  drawSubHeader('Cart Summary');
  drawParagraph('The cart page displays:');
  drawBullet('Complete list of all products added');
  drawBullet('Quantity and rate for each item');
  drawBullet('Line-item totals');
  drawBullet('Applied scheme discounts');
  drawBullet('Subtotal and final total');
  yPos += 3;

  drawSubHeader('Modifying Quantities');
  drawNumberedStep(1, 'Find the product you want to modify');
  drawNumberedStep(2, 'Use +/- buttons or type directly to change quantity');
  drawNumberedStep(3, 'Cart total updates automatically');
  yPos += 3;

  drawSubHeader('Removing Items');
  drawParagraph('Tap the trash/delete icon next to any item to remove it from the cart. You\'ll be asked to confirm before removal.');

  drawTipBox('Review your cart carefully before proceeding to payment to avoid errors.');

  // ==================== SECTION 12: PAYMENT OPTIONS ====================
  addPage();
  drawSectionHeader('12. Payment Options');

  drawSubHeader('Payment Types');
  drawParagraph('Choose how the retailer will pay for this order:');
  yPos += 3;

  drawBullet('Full Payment: Retailer pays the complete order amount now');
  drawBullet('Partial Payment: Retailer pays a portion, rest goes to credit');
  drawBullet('Credit: Entire order amount added to retailer\'s pending dues');
  yPos += 5;

  drawSubHeader('Payment Methods');
  drawParagraph('For Full or Partial payments, select the collection method:');
  yPos += 3;

  doc.setFont('helvetica', 'bold');
  drawBullet('Cash: No additional information required');
  doc.setFont('helvetica', 'normal');
  yPos += 2;

  doc.setFont('helvetica', 'bold');
  drawBullet('Cheque:');
  doc.setFont('helvetica', 'normal');
  drawParagraph('  - Enter cheque number', 10);
  drawParagraph('  - Take photo of the cheque', 10);
  yPos += 2;

  doc.setFont('helvetica', 'bold');
  drawBullet('UPI:');
  doc.setFont('helvetica', 'normal');
  drawParagraph('  - Enter last 4 digits of transaction ID', 10);
  drawParagraph('  - Take screenshot/photo of payment confirmation', 10);
  yPos += 2;

  doc.setFont('helvetica', 'bold');
  drawBullet('NEFT/Bank Transfer:');
  doc.setFont('helvetica', 'normal');
  drawParagraph('  - Enter reference number', 10);
  drawParagraph('  - Take photo of transfer receipt', 10);

  drawTipBox('Always collect payment proof (photos) for non-cash payments to avoid disputes.');

  // ==================== SECTION 13: INVOICE PREVIEW ====================
  addPage();
  drawSectionHeader('13. Invoice Preview');

  drawSubHeader('Previewing Before Submission');
  drawNumberedStep(1, 'On the cart page, look for the "Preview Invoice" button');
  drawNumberedStep(2, 'Tap to generate a preview of the invoice');
  drawNumberedStep(3, 'Review all details including products, quantities, and totals');
  drawNumberedStep(4, 'Verify retailer name and address');
  drawNumberedStep(5, 'Check applied discounts and final amount');
  yPos += 5;

  drawSubHeader('Invoice Details');
  drawParagraph('The invoice preview includes:');
  drawBullet('Invoice number (auto-generated)');
  drawBullet('Date and time');
  drawBullet('Retailer details (name, address, GST)');
  drawBullet('Product-wise breakdown');
  drawBullet('Tax calculations (GST)');
  drawBullet('Payment information');
  drawBullet('Terms and conditions');
  yPos += 3;

  drawSubHeader('Company vs Distributor Headers');
  drawParagraph('The invoice header (logo, address, GST) can come from either your company or the assigned distributor, depending on your organization\'s configuration.');

  // ==================== SECTION 14: SUBMITTING THE ORDER ====================
  addPage();
  drawSectionHeader('14. Submitting the Order');

  drawSubHeader('Final Submission');
  drawNumberedStep(1, 'Review all items in the cart');
  drawNumberedStep(2, 'Select payment type and method');
  drawNumberedStep(3, 'Enter payment details if required');
  drawNumberedStep(4, 'Tap the "Place Order" button');
  drawNumberedStep(5, 'Wait for confirmation message');
  yPos += 5;

  drawSubHeader('Confirmation');
  drawParagraph('Upon successful submission, you\'ll see:');
  drawBullet('Success message with order number');
  drawBullet('Option to share invoice via WhatsApp');
  drawBullet('Option to download invoice PDF');
  drawBullet('Automatic return to My Visits page');
  yPos += 3;

  drawSubHeader('Offline Submission');
  drawParagraph('If you\'re offline when placing the order:');
  drawBullet('The order is saved locally on your device');
  drawBullet('An "Offline Order" badge appears on the order');
  drawBullet('When you\'re back online, it syncs automatically');
  drawBullet('You\'ll get a notification once synced');

  drawTipBox('Don\'t worry about losing orders when offline. They\'re safely stored and will sync when connectivity returns.');

  // ==================== SECTION 15: WORKING OFFLINE ====================
  addPage();
  drawSectionHeader('15. Working Offline');

  drawParagraph('The app is designed to work seamlessly even without internet connectivity:');
  yPos += 5;

  drawSubHeader('Offline Indicator');
  drawParagraph('A "No Connection" or wifi-off icon appears in the header when you\'re offline. The status changes in real-time as connectivity fluctuates.');
  yPos += 3;

  drawSubHeader('What Works Offline');
  drawBullet('Viewing product catalog and prices');
  drawBullet('Adding products to cart');
  drawBullet('Placing orders (saved locally)');
  drawBullet('Recording no-order visits');
  drawBullet('Viewing today\'s beat plan');
  drawBullet('Basic navigation and app features');
  yPos += 3;

  drawSubHeader('What Requires Internet');
  drawBullet('AI Voice Order and Smart Basket');
  drawBullet('Real-time scheme updates');
  drawBullet('Photo uploads (queued for later)');
  drawBullet('Syncing pending orders');
  yPos += 3;

  drawSubHeader('Auto-Sync');
  drawParagraph('When you reconnect to the internet, the app automatically:');
  drawNumberedStep(1, 'Syncs all pending orders');
  drawNumberedStep(2, 'Uploads queued photos');
  drawNumberedStep(3, 'Refreshes product and scheme data');
  drawNumberedStep(4, 'Notifies you of successful syncs');

  // ==================== SECTION 16: TROUBLESHOOTING ====================
  addPage();
  drawSectionHeader('16. Troubleshooting');

  drawSubHeader('Order Not Saving');
  drawParagraph('If your order fails to save:');
  drawNumberedStep(1, 'Check your internet connection');
  drawNumberedStep(2, 'Try again - the order may save offline');
  drawNumberedStep(3, 'Ensure all required fields are filled');
  drawNumberedStep(4, 'Check if the app needs an update');
  drawNumberedStep(5, 'Contact support if the issue persists');
  yPos += 3;

  drawSubHeader('Products Not Loading');
  drawParagraph('If products don\'t appear:');
  drawNumberedStep(1, 'Pull down to refresh the product list');
  drawNumberedStep(2, 'Check if you have internet connection');
  drawNumberedStep(3, 'Go to Settings and tap "Clear Cache"');
  drawNumberedStep(4, 'Log out and log back in');
  yPos += 3;

  drawSubHeader('Payment Photo Not Uploading');
  drawParagraph('Photo uploads that fail are queued for retry:');
  drawBullet('The order is saved with photo pending');
  drawBullet('When online, photos auto-upload');
  drawBullet('Check Settings > Sync Status for pending uploads');
  yPos += 3;

  drawSubHeader('GPS/Location Issues');
  drawParagraph('If location tracking shows errors:');
  drawNumberedStep(1, 'Ensure Location permission is granted');
  drawNumberedStep(2, 'Turn on GPS/Location Services on your device');
  drawNumberedStep(3, 'Go to an open area for better signal');
  drawNumberedStep(4, 'Tap the refresh/recheck location button');

  // ==================== SECTION 17: QUICK REFERENCE ====================
  addPage();
  drawSectionHeader('17. Quick Reference Card');

  drawSubHeader('Common Actions');
  
  doc.setFillColor(...LIGHT_GRAY_RGB);
  doc.roundedRect(MARGIN, yPos - 2, CONTENT_WIDTH, 60, 3, 3, 'F');
  yPos += 5;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Action', MARGIN + 5, yPos);
  doc.text('How To', MARGIN + 60, yPos);
  yPos += 7;
  
  doc.setFont('helvetica', 'normal');
  const quickActions = [
    ['Add Product', 'Select product → Enter qty → Add to Cart'],
    ['Voice Order', 'Tap mic icon → Speak → Confirm'],
    ['View Schemes', 'Tap gift icon on product'],
    ['Submit Order', 'Cart → Payment → Place Order'],
    ['Record Return', 'Returns tab → Enter items → Submit'],
    ['No Order', 'No Order tab → Select reason → Submit'],
  ];
  
  quickActions.forEach(([action, howTo]) => {
    doc.text(action, MARGIN + 5, yPos);
    doc.text(howTo, MARGIN + 60, yPos);
    yPos += 6;
  });
  yPos += 10;

  drawSubHeader('Status Icons');
  drawBullet('🟢 Online - Connected to internet');
  drawBullet('🔴 Offline - No internet, working locally');
  drawBullet('📍 GPS Active - Location being tracked');
  drawBullet('⚠️ Warning - Action needed');
  drawBullet('🎁 Scheme - Product has active offer');
  drawBullet('⭐ Focused - Priority product');
  yPos += 5;

  drawSubHeader('Support');
  drawParagraph('For technical issues or questions:');
  drawBullet('Contact your supervisor or area manager');
  drawBullet('Reach out to IT support');
  drawBullet('Use the in-app Help section');

  // ==================== FILL TABLE OF CONTENTS ====================
  // Go back to TOC page and fill it
  doc.setPage(tocPageNumber);
  let tocY = 45;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  tableOfContents.forEach((item) => {
    doc.setTextColor(...DARK_SLATE_RGB);
    doc.text(item.title, MARGIN, tocY);
    doc.setTextColor(...GRAY_RGB);
    // Draw dots
    const titleWidth = doc.getTextWidth(item.title);
    const pageNumWidth = doc.getTextWidth(String(item.pageNumber));
    const dotsWidth = CONTENT_WIDTH - titleWidth - pageNumWidth - 5;
    const dots = '.'.repeat(Math.floor(dotsWidth / 2));
    doc.text(dots, MARGIN + titleWidth + 2, tocY);
    doc.setTextColor(...AMBER_RGB);
    doc.text(String(item.pageNumber), PAGE_WIDTH - MARGIN, tocY, { align: 'right' });
    tocY += 8;
  });

  // Save the PDF
  const fileName = `Order-Entry-Guide-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  doc.save(fileName);
}
