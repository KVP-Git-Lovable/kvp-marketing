import type jsPDF from 'jspdf';
import { format } from 'date-fns';

// Constants
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 15;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

// Colors
const AMBER = { r: 245, g: 158, b: 11 };
const DARK_BG = { r: 26, g: 31, b: 44 };
const GRAY = { r: 100, g: 100, b: 100 };
const LIGHT_GRAY = { r: 200, g: 200, b: 200 };
const WHITE = { r: 255, g: 255, b: 255 };
const GREEN = { r: 34, g: 197, b: 94 };
const BLUE = { r: 59, g: 130, b: 246 };

let currentPage = 1;
let yPos = MARGIN;

// Helper functions
const setColor = (doc: jsPDF, color: { r: number; g: number; b: number }, type: 'fill' | 'draw' | 'text' = 'fill') => {
  if (type === 'fill') doc.setFillColor(color.r, color.g, color.b);
  else if (type === 'draw') doc.setDrawColor(color.r, color.g, color.b);
  else doc.setTextColor(color.r, color.g, color.b);
};

const checkPageBreak = (doc: jsPDF, height: number): boolean => {
  if (yPos + height > PAGE_HEIGHT - MARGIN) {
    doc.addPage();
    currentPage++;
    yPos = MARGIN;
    return true;
  }
  return false;
};

const drawPhoneMockup = (doc: jsPDF, x: number, y: number, width: number, height: number) => {
  // Phone frame
  doc.setLineWidth(2);
  setColor(doc, DARK_BG, 'draw');
  doc.roundedRect(x, y, width, height, 8, 8, 'S');
  
  // Screen area (white background)
  const screenMargin = 4;
  setColor(doc, WHITE, 'fill');
  doc.roundedRect(x + screenMargin, y + screenMargin, width - 2 * screenMargin, height - 2 * screenMargin, 4, 4, 'F');
  
  // Status bar
  setColor(doc, LIGHT_GRAY, 'fill');
  doc.rect(x + screenMargin, y + screenMargin, width - 2 * screenMargin, 6, 'F');
  
  return { screenX: x + screenMargin, screenY: y + screenMargin + 6, screenWidth: width - 2 * screenMargin, screenHeight: height - 2 * screenMargin - 6 };
};

const drawCallout = (doc: jsPDF, x: number, y: number, number: number, label: string) => {
  // Circle with number
  setColor(doc, AMBER, 'fill');
  doc.circle(x, y, 4, 'F');
  setColor(doc, WHITE, 'text');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text(String(number), x, y + 1.5, { align: 'center' });
  
  // Label
  setColor(doc, GRAY, 'text');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(label, x + 6, y + 1);
};

const drawArrow = (doc: jsPDF, fromX: number, fromY: number, toX: number, toY: number) => {
  setColor(doc, AMBER, 'draw');
  doc.setLineWidth(1);
  doc.line(fromX, fromY, toX, toY);
  
  // Arrow head
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const headLen = 4;
  doc.line(toX, toY, toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
  doc.line(toX, toY, toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
};

const drawHighlightBox = (doc: jsPDF, x: number, y: number, width: number, height: number) => {
  setColor(doc, AMBER, 'draw');
  doc.setLineWidth(0.5);
  doc.setLineDashPattern([2, 2], 0);
  doc.rect(x, y, width, height, 'S');
  doc.setLineDashPattern([], 0);
};

const drawButton = (doc: jsPDF, x: number, y: number, width: number, height: number, text: string, color: { r: number; g: number; b: number } = AMBER) => {
  setColor(doc, color, 'fill');
  doc.roundedRect(x, y, width, height, 2, 2, 'F');
  setColor(doc, WHITE, 'text');
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text(text, x + width / 2, y + height / 2 + 1.5, { align: 'center' });
};

const drawInputField = (doc: jsPDF, x: number, y: number, width: number, height: number, placeholder: string) => {
  setColor(doc, LIGHT_GRAY, 'draw');
  doc.setLineWidth(0.5);
  doc.roundedRect(x, y, width, height, 2, 2, 'S');
  setColor(doc, GRAY, 'text');
  doc.setFontSize(5);
  doc.text(placeholder, x + 2, y + height / 2 + 1);
};

const drawSectionHeader = (doc: jsPDF, title: string, sectionNumber: number) => {
  checkPageBreak(doc, 20);
  
  setColor(doc, AMBER, 'text');
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`${sectionNumber}. ${title}`, MARGIN, yPos);
  yPos += 6;
  
  setColor(doc, AMBER, 'draw');
  doc.setLineWidth(0.5);
  doc.line(MARGIN, yPos, PAGE_WIDTH - MARGIN, yPos);
  yPos += 8;
};

const drawSubHeader = (doc: jsPDF, title: string) => {
  checkPageBreak(doc, 12);
  setColor(doc, DARK_BG, 'text');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(title, MARGIN, yPos);
  yPos += 6;
};

const drawParagraph = (doc: jsPDF, text: string, indent: number = 0) => {
  setColor(doc, GRAY, 'text');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH - indent);
  checkPageBreak(doc, lines.length * 5);
  doc.text(lines, MARGIN + indent, yPos);
  yPos += lines.length * 5 + 3;
};

const drawBullet = (doc: jsPDF, text: string, indent: number = 5) => {
  checkPageBreak(doc, 8);
  setColor(doc, AMBER, 'text');
  doc.setFontSize(9);
  doc.text('•', MARGIN + indent, yPos);
  setColor(doc, GRAY, 'text');
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH - indent - 8);
  doc.text(lines, MARGIN + indent + 5, yPos);
  yPos += lines.length * 5 + 2;
};

const drawStepInstruction = (doc: jsPDF, stepNum: number, instruction: string) => {
  checkPageBreak(doc, 10);
  
  // Step number circle
  setColor(doc, AMBER, 'fill');
  doc.circle(MARGIN + 5, yPos - 2, 4, 'F');
  setColor(doc, WHITE, 'text');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(String(stepNum), MARGIN + 5, yPos - 0.5, { align: 'center' });
  
  // Instruction text
  setColor(doc, DARK_BG, 'text');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const lines = doc.splitTextToSize(instruction, CONTENT_WIDTH - 15);
  doc.text(lines, MARGIN + 12, yPos);
  yPos += lines.length * 5 + 4;
};

// ========== SCREEN MOCKUPS ==========

const drawLoginScreen = (doc: jsPDF) => {
  const phoneX = MARGIN + 10;
  const phoneY = yPos;
  const phoneWidth = 60;
  const phoneHeight = 100;
  
  const screen = drawPhoneMockup(doc, phoneX, phoneY, phoneWidth, phoneHeight);
  
  // App logo placeholder
  setColor(doc, AMBER, 'fill');
  doc.circle(screen.screenX + screen.screenWidth / 2, screen.screenY + 15, 8, 'F');
  setColor(doc, WHITE, 'text');
  doc.setFontSize(6);
  doc.text('Q', screen.screenX + screen.screenWidth / 2, screen.screenY + 17, { align: 'center' });
  
  // Title
  setColor(doc, DARK_BG, 'text');
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text('Sign In', screen.screenX + screen.screenWidth / 2, screen.screenY + 30, { align: 'center' });
  
  // Email field
  const emailY = screen.screenY + 38;
  drawInputField(doc, screen.screenX + 4, emailY, screen.screenWidth - 8, 8, 'Email address');
  
  // Password field
  const passY = screen.screenY + 50;
  drawInputField(doc, screen.screenX + 4, passY, screen.screenWidth - 8, 8, 'Password');
  
  // Sign in button
  const btnY = screen.screenY + 65;
  drawButton(doc, screen.screenX + 4, btnY, screen.screenWidth - 8, 10, 'Sign In');
  
  // Callouts
  drawCallout(doc, phoneX + phoneWidth + 8, emailY + 4, 1, 'Enter your email');
  drawArrow(doc, phoneX + phoneWidth + 4, emailY + 4, phoneX + phoneWidth - 2, emailY + 4);
  
  drawCallout(doc, phoneX + phoneWidth + 8, passY + 4, 2, 'Enter password');
  drawArrow(doc, phoneX + phoneWidth + 4, passY + 4, phoneX + phoneWidth - 2, passY + 4);
  
  drawCallout(doc, phoneX + phoneWidth + 8, btnY + 5, 3, 'Tap to sign in');
  drawArrow(doc, phoneX + phoneWidth + 4, btnY + 5, phoneX + phoneWidth - 2, btnY + 5);
  
  yPos = phoneY + phoneHeight + 10;
};

const drawDashboardScreen = (doc: jsPDF) => {
  const phoneX = MARGIN + 10;
  const phoneY = yPos;
  const phoneWidth = 60;
  const phoneHeight = 100;
  
  const screen = drawPhoneMockup(doc, phoneX, phoneY, phoneWidth, phoneHeight);
  
  // Header
  setColor(doc, DARK_BG, 'fill');
  doc.rect(screen.screenX, screen.screenY, screen.screenWidth, 12, 'F');
  setColor(doc, WHITE, 'text');
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text('Dashboard', screen.screenX + screen.screenWidth / 2, screen.screenY + 7, { align: 'center' });
  
  // Stats cards
  const cardY = screen.screenY + 16;
  setColor(doc, { r: 240, g: 240, b: 240 }, 'fill');
  doc.roundedRect(screen.screenX + 2, cardY, 24, 18, 2, 2, 'F');
  doc.roundedRect(screen.screenX + 28, cardY, 24, 18, 2, 2, 'F');
  
  setColor(doc, DARK_BG, 'text');
  doc.setFontSize(4);
  doc.text('Today\'s Visits', screen.screenX + 14, cardY + 6, { align: 'center' });
  doc.text('Orders', screen.screenX + 40, cardY + 6, { align: 'center' });
  
  setColor(doc, AMBER, 'text');
  doc.setFontSize(8);
  doc.text('12', screen.screenX + 14, cardY + 14, { align: 'center' });
  doc.text('8', screen.screenX + 40, cardY + 14, { align: 'center' });
  
  // My Visits button (highlighted)
  const visitsY = screen.screenY + 40;
  drawHighlightBox(doc, screen.screenX + 2, visitsY, screen.screenWidth - 4, 12);
  setColor(doc, AMBER, 'fill');
  doc.roundedRect(screen.screenX + 4, visitsY + 2, screen.screenWidth - 8, 8, 2, 2, 'F');
  setColor(doc, WHITE, 'text');
  doc.setFontSize(5);
  doc.text('My Visits', screen.screenX + screen.screenWidth / 2, visitsY + 7, { align: 'center' });
  
  // Bottom nav
  const navY = screen.screenY + screen.screenHeight - 14;
  setColor(doc, { r: 250, g: 250, b: 250 }, 'fill');
  doc.rect(screen.screenX, navY, screen.screenWidth, 12, 'F');
  
  // Callout
  drawCallout(doc, phoneX + phoneWidth + 8, visitsY + 6, 1, 'Tap "My Visits" to start');
  drawArrow(doc, phoneX + phoneWidth + 4, visitsY + 6, phoneX + phoneWidth - 2, visitsY + 6);
  
  yPos = phoneY + phoneHeight + 10;
};

const drawMyVisitsScreen = (doc: jsPDF) => {
  const phoneX = MARGIN + 10;
  const phoneY = yPos;
  const phoneWidth = 60;
  const phoneHeight = 100;
  
  const screen = drawPhoneMockup(doc, phoneX, phoneY, phoneWidth, phoneHeight);
  
  // Header
  setColor(doc, DARK_BG, 'fill');
  doc.rect(screen.screenX, screen.screenY, screen.screenWidth, 12, 'F');
  setColor(doc, WHITE, 'text');
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text('My Visits', screen.screenX + screen.screenWidth / 2, screen.screenY + 7, { align: 'center' });
  
  // Beat name
  setColor(doc, AMBER, 'text');
  doc.setFontSize(5);
  doc.text('Beat: Market Area 1', screen.screenX + 4, screen.screenY + 18);
  
  // Retailer cards
  const card1Y = screen.screenY + 22;
  setColor(doc, { r: 250, g: 250, b: 250 }, 'fill');
  doc.roundedRect(screen.screenX + 2, card1Y, screen.screenWidth - 4, 20, 2, 2, 'F');
  
  setColor(doc, DARK_BG, 'text');
  doc.setFontSize(5);
  doc.setFont('helvetica', 'bold');
  doc.text('AM Stores', screen.screenX + 5, card1Y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4);
  setColor(doc, GRAY, 'text');
  doc.text('Main Street, Block A', screen.screenX + 5, card1Y + 11);
  
  // Take Order button (highlighted)
  drawHighlightBox(doc, screen.screenX + 30, card1Y + 12, 20, 6);
  drawButton(doc, screen.screenX + 31, card1Y + 13, 18, 4, 'Take Order', GREEN);
  
  // Second card
  const card2Y = screen.screenY + 46;
  setColor(doc, { r: 250, g: 250, b: 250 }, 'fill');
  doc.roundedRect(screen.screenX + 2, card2Y, screen.screenWidth - 4, 20, 2, 2, 'F');
  setColor(doc, DARK_BG, 'text');
  doc.setFontSize(5);
  doc.setFont('helvetica', 'bold');
  doc.text('City Mart', screen.screenX + 5, card2Y + 6);
  
  // Callout
  drawCallout(doc, phoneX + phoneWidth + 8, card1Y + 15, 1, 'Tap "Take Order" on retailer');
  drawArrow(doc, phoneX + phoneWidth + 4, card1Y + 15, phoneX + phoneWidth - 2, card1Y + 15);
  
  yPos = phoneY + phoneHeight + 10;
};

const drawOrderEntryScreen = (doc: jsPDF) => {
  const phoneX = MARGIN + 10;
  const phoneY = yPos;
  const phoneWidth = 60;
  const phoneHeight = 100;
  
  const screen = drawPhoneMockup(doc, phoneX, phoneY, phoneWidth, phoneHeight);
  
  // Header with retailer name
  setColor(doc, DARK_BG, 'fill');
  doc.rect(screen.screenX, screen.screenY, screen.screenWidth, 14, 'F');
  setColor(doc, WHITE, 'text');
  doc.setFontSize(5);
  doc.setFont('helvetica', 'bold');
  doc.text('AM Stores', screen.screenX + 4, screen.screenY + 6);
  
  // Online indicator
  setColor(doc, GREEN, 'fill');
  doc.circle(screen.screenX + screen.screenWidth - 8, screen.screenY + 5, 2, 'F');
  setColor(doc, WHITE, 'text');
  doc.setFontSize(3);
  doc.text('Online', screen.screenX + screen.screenWidth - 8, screen.screenY + 10, { align: 'center' });
  
  // Tabs
  const tabY = screen.screenY + 16;
  setColor(doc, AMBER, 'fill');
  doc.roundedRect(screen.screenX + 2, tabY, 16, 6, 1, 1, 'F');
  setColor(doc, LIGHT_GRAY, 'fill');
  doc.roundedRect(screen.screenX + 20, tabY, 16, 6, 1, 1, 'F');
  doc.roundedRect(screen.screenX + 38, tabY, 14, 6, 1, 1, 'F');
  
  setColor(doc, WHITE, 'text');
  doc.setFontSize(4);
  doc.text('Table', screen.screenX + 10, tabY + 4, { align: 'center' });
  setColor(doc, DARK_BG, 'text');
  doc.text('Grid', screen.screenX + 28, tabY + 4, { align: 'center' });
  doc.text('Voice', screen.screenX + 45, tabY + 4, { align: 'center' });
  
  // Order form
  const formY = screen.screenY + 26;
  setColor(doc, DARK_BG, 'text');
  doc.setFontSize(4);
  doc.text('Product', screen.screenX + 4, formY);
  drawInputField(doc, screen.screenX + 2, formY + 2, screen.screenWidth - 4, 8, 'Select product...');
  
  doc.text('Variant', screen.screenX + 4, formY + 14);
  drawInputField(doc, screen.screenX + 2, formY + 16, screen.screenWidth - 4, 8, 'Select variant...');
  
  doc.text('Quantity', screen.screenX + 4, formY + 28);
  drawInputField(doc, screen.screenX + 2, formY + 30, 20, 8, '0');
  
  doc.text('Unit', screen.screenX + 30, formY + 28);
  drawInputField(doc, screen.screenX + 28, formY + 30, 24, 8, 'Pieces');
  
  // Add to Cart button
  const cartBtnY = formY + 45;
  drawButton(doc, screen.screenX + 4, cartBtnY, screen.screenWidth - 8, 10, 'Add to Cart', AMBER);
  
  // Callouts
  drawCallout(doc, phoneX + phoneWidth + 8, tabY + 3, 1, 'Select order mode');
  drawArrow(doc, phoneX + phoneWidth + 4, tabY + 3, phoneX + phoneWidth - 2, tabY + 3);
  
  drawCallout(doc, phoneX + phoneWidth + 8, formY + 6, 2, 'Choose product');
  drawArrow(doc, phoneX + phoneWidth + 4, formY + 6, phoneX + phoneWidth - 2, formY + 6);
  
  drawCallout(doc, phoneX + phoneWidth + 8, formY + 20, 3, 'Select variant');
  drawArrow(doc, phoneX + phoneWidth + 4, formY + 20, phoneX + phoneWidth - 2, formY + 20);
  
  drawCallout(doc, phoneX + phoneWidth + 8, formY + 34, 4, 'Enter quantity');
  drawArrow(doc, phoneX + phoneWidth + 4, formY + 34, phoneX + phoneWidth - 2, formY + 34);
  
  drawCallout(doc, phoneX + phoneWidth + 8, cartBtnY + 5, 5, 'Add to cart');
  drawArrow(doc, phoneX + phoneWidth + 4, cartBtnY + 5, phoneX + phoneWidth - 2, cartBtnY + 5);
  
  yPos = phoneY + phoneHeight + 10;
};

const drawGridViewScreen = (doc: jsPDF) => {
  const phoneX = MARGIN + 10;
  const phoneY = yPos;
  const phoneWidth = 60;
  const phoneHeight = 100;
  
  const screen = drawPhoneMockup(doc, phoneX, phoneY, phoneWidth, phoneHeight);
  
  // Header
  setColor(doc, DARK_BG, 'fill');
  doc.rect(screen.screenX, screen.screenY, screen.screenWidth, 10, 'F');
  setColor(doc, WHITE, 'text');
  doc.setFontSize(5);
  doc.text('Grid View', screen.screenX + screen.screenWidth / 2, screen.screenY + 6, { align: 'center' });
  
  // Category tabs
  const catY = screen.screenY + 12;
  setColor(doc, AMBER, 'fill');
  doc.roundedRect(screen.screenX + 2, catY, 14, 5, 1, 1, 'F');
  setColor(doc, LIGHT_GRAY, 'fill');
  doc.roundedRect(screen.screenX + 18, catY, 14, 5, 1, 1, 'F');
  doc.roundedRect(screen.screenX + 34, catY, 14, 5, 1, 1, 'F');
  
  setColor(doc, WHITE, 'text');
  doc.setFontSize(3);
  doc.text('All', screen.screenX + 9, catY + 3.5, { align: 'center' });
  setColor(doc, DARK_BG, 'text');
  doc.text('Drinks', screen.screenX + 25, catY + 3.5, { align: 'center' });
  doc.text('Snacks', screen.screenX + 41, catY + 3.5, { align: 'center' });
  
  // Product cards grid
  const gridY = screen.screenY + 20;
  const cardW = 24;
  const cardH = 28;
  
  // Card 1
  setColor(doc, { r: 250, g: 250, b: 250 }, 'fill');
  doc.roundedRect(screen.screenX + 2, gridY, cardW, cardH, 2, 2, 'F');
  setColor(doc, LIGHT_GRAY, 'fill');
  doc.rect(screen.screenX + 4, gridY + 2, 20, 12, 'F'); // Image placeholder
  setColor(doc, DARK_BG, 'text');
  doc.setFontSize(4);
  doc.text('Cola 500ml', screen.screenX + 14, gridY + 18, { align: 'center' });
  setColor(doc, GREEN, 'text');
  doc.text('₹25', screen.screenX + 14, gridY + 22, { align: 'center' });
  
  // +/- buttons
  drawButton(doc, screen.screenX + 4, gridY + 24, 6, 4, '-', GRAY);
  setColor(doc, DARK_BG, 'text');
  doc.text('0', screen.screenX + 14, gridY + 27, { align: 'center' });
  drawButton(doc, screen.screenX + 18, gridY + 24, 6, 4, '+', AMBER);
  
  // Card 2
  setColor(doc, { r: 250, g: 250, b: 250 }, 'fill');
  doc.roundedRect(screen.screenX + 28, gridY, cardW, cardH, 2, 2, 'F');
  setColor(doc, LIGHT_GRAY, 'fill');
  doc.rect(screen.screenX + 30, gridY + 2, 20, 12, 'F');
  setColor(doc, DARK_BG, 'text');
  doc.text('Chips', screen.screenX + 40, gridY + 18, { align: 'center' });
  setColor(doc, GREEN, 'text');
  doc.text('₹20', screen.screenX + 40, gridY + 22, { align: 'center' });
  
  // Scheme indicator
  setColor(doc, AMBER, 'fill');
  doc.circle(screen.screenX + 48, gridY + 4, 3, 'F');
  setColor(doc, WHITE, 'text');
  doc.setFontSize(3);
  doc.text('%', screen.screenX + 48, gridY + 5, { align: 'center' });
  
  // Callouts
  drawCallout(doc, phoneX + phoneWidth + 8, catY + 2, 1, 'Filter by category');
  drawArrow(doc, phoneX + phoneWidth + 4, catY + 2, phoneX + phoneWidth - 2, catY + 2);
  
  drawCallout(doc, phoneX + phoneWidth + 8, gridY + 15, 2, 'Product with image & price');
  drawArrow(doc, phoneX + phoneWidth + 4, gridY + 15, phoneX + phoneWidth - 2, gridY + 15);
  
  drawCallout(doc, phoneX + phoneWidth + 8, gridY + 26, 3, 'Tap +/- to adjust quantity');
  drawArrow(doc, phoneX + phoneWidth + 4, gridY + 26, phoneX + phoneWidth - 2, gridY + 26);
  
  drawCallout(doc, phoneX + phoneWidth + 8, gridY + 4, 4, 'Scheme indicator (tap for details)');
  drawArrow(doc, phoneX + phoneWidth + 4, gridY + 4, phoneX + phoneWidth - 8, gridY + 4);
  
  yPos = phoneY + phoneHeight + 10;
};

const drawCartScreen = (doc: jsPDF) => {
  const phoneX = MARGIN + 10;
  const phoneY = yPos;
  const phoneWidth = 60;
  const phoneHeight = 100;
  
  const screen = drawPhoneMockup(doc, phoneX, phoneY, phoneWidth, phoneHeight);
  
  // Header
  setColor(doc, DARK_BG, 'fill');
  doc.rect(screen.screenX, screen.screenY, screen.screenWidth, 10, 'F');
  setColor(doc, WHITE, 'text');
  doc.setFontSize(5);
  doc.text('Cart Summary', screen.screenX + screen.screenWidth / 2, screen.screenY + 6, { align: 'center' });
  
  // Cart items
  const item1Y = screen.screenY + 14;
  setColor(doc, { r: 250, g: 250, b: 250 }, 'fill');
  doc.roundedRect(screen.screenX + 2, item1Y, screen.screenWidth - 4, 14, 2, 2, 'F');
  
  setColor(doc, DARK_BG, 'text');
  doc.setFontSize(4);
  doc.setFont('helvetica', 'bold');
  doc.text('Cola 500ml x 10', screen.screenX + 5, item1Y + 5);
  doc.setFont('helvetica', 'normal');
  setColor(doc, GRAY, 'text');
  doc.text('₹25 x 10 = ₹250', screen.screenX + 5, item1Y + 10);
  
  // Delete icon
  setColor(doc, { r: 239, g: 68, b: 68 }, 'text');
  doc.text('×', screen.screenX + screen.screenWidth - 8, item1Y + 7);
  
  // Second item
  const item2Y = screen.screenY + 30;
  setColor(doc, { r: 250, g: 250, b: 250 }, 'fill');
  doc.roundedRect(screen.screenX + 2, item2Y, screen.screenWidth - 4, 14, 2, 2, 'F');
  setColor(doc, DARK_BG, 'text');
  doc.setFont('helvetica', 'bold');
  doc.text('Chips x 5', screen.screenX + 5, item2Y + 5);
  doc.setFont('helvetica', 'normal');
  setColor(doc, GRAY, 'text');
  doc.text('₹20 x 5 = ₹100', screen.screenX + 5, item2Y + 10);
  
  // Totals
  const totalsY = screen.screenY + 50;
  setColor(doc, DARK_BG, 'draw');
  doc.setLineWidth(0.3);
  doc.line(screen.screenX + 2, totalsY, screen.screenX + screen.screenWidth - 2, totalsY);
  
  setColor(doc, DARK_BG, 'text');
  doc.setFontSize(4);
  doc.text('Subtotal:', screen.screenX + 5, totalsY + 6);
  doc.text('₹350', screen.screenX + screen.screenWidth - 8, totalsY + 6, { align: 'right' });
  
  setColor(doc, GREEN, 'text');
  doc.text('Scheme Discount:', screen.screenX + 5, totalsY + 12);
  doc.text('-₹35', screen.screenX + screen.screenWidth - 8, totalsY + 12, { align: 'right' });
  
  setColor(doc, DARK_BG, 'text');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5);
  doc.text('Total:', screen.screenX + 5, totalsY + 20);
  doc.text('₹315', screen.screenX + screen.screenWidth - 8, totalsY + 20, { align: 'right' });
  
  // Place Order button
  const orderBtnY = totalsY + 28;
  drawButton(doc, screen.screenX + 4, orderBtnY, screen.screenWidth - 8, 12, 'Place Order', GREEN);
  
  // Callouts
  drawCallout(doc, phoneX + phoneWidth + 8, item1Y + 7, 1, 'Review items in cart');
  drawArrow(doc, phoneX + phoneWidth + 4, item1Y + 7, phoneX + phoneWidth - 2, item1Y + 7);
  
  drawCallout(doc, phoneX + phoneWidth + 8, totalsY + 10, 2, 'Check totals & discounts');
  drawArrow(doc, phoneX + phoneWidth + 4, totalsY + 10, phoneX + phoneWidth - 2, totalsY + 10);
  
  drawCallout(doc, phoneX + phoneWidth + 8, orderBtnY + 6, 3, 'Tap to submit order');
  drawArrow(doc, phoneX + phoneWidth + 4, orderBtnY + 6, phoneX + phoneWidth - 2, orderBtnY + 6);
  
  yPos = phoneY + phoneHeight + 10;
};

const drawConfirmationScreen = (doc: jsPDF) => {
  const phoneX = MARGIN + 10;
  const phoneY = yPos;
  const phoneWidth = 60;
  const phoneHeight = 80;
  
  const screen = drawPhoneMockup(doc, phoneX, phoneY, phoneWidth, phoneHeight);
  
  // Success icon
  setColor(doc, GREEN, 'fill');
  doc.circle(screen.screenX + screen.screenWidth / 2, screen.screenY + 20, 12, 'F');
  setColor(doc, WHITE, 'text');
  doc.setFontSize(12);
  doc.text('✓', screen.screenX + screen.screenWidth / 2, screen.screenY + 24, { align: 'center' });
  
  // Success message
  setColor(doc, DARK_BG, 'text');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('Order Placed!', screen.screenX + screen.screenWidth / 2, screen.screenY + 40, { align: 'center' });
  
  // Order ID
  setColor(doc, GRAY, 'text');
  doc.setFontSize(5);
  doc.setFont('helvetica', 'normal');
  doc.text('Order #ORD-2024-0123', screen.screenX + screen.screenWidth / 2, screen.screenY + 48, { align: 'center' });
  
  // View Invoice button
  drawButton(doc, screen.screenX + 8, screen.screenY + 55, screen.screenWidth - 16, 8, 'View Invoice', BLUE);
  
  yPos = phoneY + phoneHeight + 10;
};

// ========== MAIN GENERATOR ==========

export async function generateOrderGuideWithScreenshotsPDF(): Promise<void> {
  const { default: jsPDFConstructor } = await import('jspdf');
  const doc = new jsPDFConstructor() as jsPDF;
  currentPage = 1;
  yPos = MARGIN;
  
  // ===== COVER PAGE =====
  setColor(doc, DARK_BG, 'fill');
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F');
  
  setColor(doc, WHITE, 'text');
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('Order Creation', PAGE_WIDTH / 2, 70, { align: 'center' });
  doc.text('Step-by-Step Guide', PAGE_WIDTH / 2, 85, { align: 'center' });
  
  setColor(doc, AMBER, 'text');
  doc.setFontSize(16);
  doc.text('with Visual Instructions', PAGE_WIDTH / 2, 100, { align: 'center' });
  
  // Decorative line
  setColor(doc, AMBER, 'draw');
  doc.setLineWidth(1);
  doc.line(60, 110, 150, 110);
  
  setColor(doc, WHITE, 'text');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Quickapp Field Sales Application', PAGE_WIDTH / 2, 130, { align: 'center' });
  
  setColor(doc, { r: 180, g: 180, b: 180 }, 'text');
  doc.setFontSize(10);
  doc.text(`Version 2.0 | ${format(new Date(), 'MMMM yyyy')}`, PAGE_WIDTH / 2, 145, { align: 'center' });
  
  // Footer
  setColor(doc, AMBER, 'text');
  doc.setFontSize(10);
  doc.text('Quickapp.ai', PAGE_WIDTH / 2, 260, { align: 'center' });
  setColor(doc, { r: 150, g: 150, b: 150 }, 'text');
  doc.setFontSize(8);
  doc.text('AI-Forward Commerce Platform', PAGE_WIDTH / 2, 268, { align: 'center' });
  
  // ===== TABLE OF CONTENTS =====
  doc.addPage();
  currentPage++;
  yPos = MARGIN;
  
  setColor(doc, AMBER, 'text');
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Table of Contents', MARGIN, yPos);
  yPos += 15;
  
  const tocItems = [
    { num: '1', title: 'Login to Application', page: 3 },
    { num: '2', title: 'Navigate to My Visits', page: 4 },
    { num: '3', title: 'Select Retailer', page: 5 },
    { num: '4', title: 'Order Entry Screen Overview', page: 6 },
    { num: '5', title: 'Table View Order Entry', page: 7 },
    { num: '6', title: 'Grid View Order Entry', page: 9 },
    { num: '7', title: 'Voice Order Entry', page: 11 },
    { num: '8', title: 'Understanding Schemes & Offers', page: 12 },
    { num: '9', title: 'Smart Basket (AI Recommendations)', page: 13 },
    { num: '10', title: 'Managing Returns', page: 14 },
    { num: '11', title: 'Review Cart & Submit Order', page: 15 },
    { num: '12', title: 'Order Confirmation', page: 17 },
    { num: '13', title: 'Offline Mode', page: 18 },
    { num: '14', title: 'Common Errors & Solutions', page: 19 },
    { num: '15', title: 'Best Practices', page: 20 },
  ];
  
  tocItems.forEach(item => {
    setColor(doc, DARK_BG, 'text');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`${item.num}. ${item.title}`, MARGIN, yPos);
    
    // Dotted line
    const titleWidth = doc.getTextWidth(`${item.num}. ${item.title}`);
    setColor(doc, LIGHT_GRAY, 'draw');
    doc.setLineDashPattern([1, 2], 0);
    doc.line(MARGIN + titleWidth + 5, yPos, PAGE_WIDTH - MARGIN - 15, yPos);
    doc.setLineDashPattern([], 0);
    
    // Page number
    setColor(doc, AMBER, 'text');
    doc.text(String(item.page), PAGE_WIDTH - MARGIN - 10, yPos);
    
    yPos += 8;
  });
  
  // ===== SECTION 1: LOGIN =====
  doc.addPage();
  currentPage++;
  yPos = MARGIN;
  
  drawSectionHeader(doc, 'Login to Application', 1);
  
  drawParagraph(doc, 'To begin creating orders, you must first log in to the Quickapp Field Sales application with your credentials provided by your administrator.');
  
  yPos += 5;
  drawSubHeader(doc, 'Login Screen');
  yPos += 5;
  
  drawLoginScreen(doc);
  
  drawSubHeader(doc, 'Step-by-Step Instructions');
  drawStepInstruction(doc, 1, 'Open the Quickapp app on your mobile device');
  drawStepInstruction(doc, 2, 'Enter your registered email address in the email field');
  drawStepInstruction(doc, 3, 'Enter your password in the password field');
  drawStepInstruction(doc, 4, 'Tap the "Sign In" button to access your dashboard');
  
  drawParagraph(doc, 'Tip: If you forget your password, tap "Forgot Password" to receive a reset link via email.');
  
  // ===== SECTION 2: DASHBOARD =====
  doc.addPage();
  currentPage++;
  yPos = MARGIN;
  
  drawSectionHeader(doc, 'Navigate to My Visits', 2);
  
  drawParagraph(doc, 'After logging in, you will see the Dashboard with your daily statistics. To start taking orders, navigate to your scheduled visits.');
  
  yPos += 5;
  drawSubHeader(doc, 'Dashboard Screen');
  yPos += 5;
  
  drawDashboardScreen(doc);
  
  drawSubHeader(doc, 'What You\'ll See');
  drawBullet(doc, 'Today\'s visit count and completed orders');
  drawBullet(doc, 'Quick stats showing your performance');
  drawBullet(doc, '"My Visits" button to access your beat schedule');
  
  drawStepInstruction(doc, 1, 'Review your dashboard statistics');
  drawStepInstruction(doc, 2, 'Tap on "My Visits" to see your scheduled retailers');
  
  // ===== SECTION 3: MY VISITS =====
  doc.addPage();
  currentPage++;
  yPos = MARGIN;
  
  drawSectionHeader(doc, 'Select Retailer', 3);
  
  drawParagraph(doc, 'The My Visits page shows all retailers scheduled for your current beat. Each retailer card shows their name, address, and available actions.');
  
  yPos += 5;
  drawSubHeader(doc, 'My Visits Screen');
  yPos += 5;
  
  drawMyVisitsScreen(doc);
  
  drawSubHeader(doc, 'Retailer Card Information');
  drawBullet(doc, 'Retailer name and shop type');
  drawBullet(doc, 'Address and contact information');
  drawBullet(doc, 'Quick action buttons: Take Order, Check In, View History');
  
  drawStepInstruction(doc, 1, 'Scroll through your beat to find the retailer');
  drawStepInstruction(doc, 2, 'Tap "Take Order" on the retailer card');
  drawStepInstruction(doc, 3, 'This will open the Order Entry screen');
  
  // ===== SECTION 4: ORDER ENTRY OVERVIEW =====
  doc.addPage();
  currentPage++;
  yPos = MARGIN;
  
  drawSectionHeader(doc, 'Order Entry Screen Overview', 4);
  
  drawParagraph(doc, 'The Order Entry screen is your main workspace for creating orders. It offers multiple input modes to suit different ordering scenarios.');
  
  yPos += 5;
  drawSubHeader(doc, 'Order Entry Interface');
  yPos += 5;
  
  drawOrderEntryScreen(doc);
  
  drawSubHeader(doc, 'Order Entry Modes');
  
  yPos += 3;
  setColor(doc, AMBER, 'text');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Table View', MARGIN, yPos);
  yPos += 5;
  drawParagraph(doc, 'Traditional form-based entry with dropdowns for product and variant selection. Best for precise order entry with specific quantities.');
  
  setColor(doc, AMBER, 'text');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Grid View', MARGIN, yPos);
  yPos += 5;
  drawParagraph(doc, 'Visual product cards with images. Quickly add items using +/- buttons. Ideal for fast ordering of commonly purchased items.');
  
  setColor(doc, AMBER, 'text');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Voice Order', MARGIN, yPos);
  yPos += 5;
  drawParagraph(doc, 'Speak your order naturally. AI converts speech to order items. Perfect for hands-free ordering while inspecting shelves.');
  
  // ===== SECTION 5: TABLE VIEW =====
  doc.addPage();
  currentPage++;
  yPos = MARGIN;
  
  drawSectionHeader(doc, 'Table View Order Entry', 5);
  
  drawParagraph(doc, 'Table View provides the most detailed order entry experience with full control over each product selection.');
  
  yPos += 5;
  drawSubHeader(doc, 'Form Fields Explained');
  yPos += 5;
  
  // Draw a labeled form mockup
  const formY = yPos;
  
  setColor(doc, { r: 250, g: 250, b: 250 }, 'fill');
  doc.roundedRect(MARGIN, formY, CONTENT_WIDTH, 60, 3, 3, 'F');
  
  // Product field
  setColor(doc, DARK_BG, 'text');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Product Selection', MARGIN + 5, formY + 8);
  drawInputField(doc, MARGIN + 5, formY + 10, 80, 8, 'Search or select product...');
  
  // Variant field
  doc.text('2. Variant Selection', MARGIN + 95, formY + 8);
  drawInputField(doc, MARGIN + 95, formY + 10, 75, 8, 'Choose variant...');
  
  // Quantity
  doc.text('3. Quantity', MARGIN + 5, formY + 28);
  drawInputField(doc, MARGIN + 5, formY + 30, 40, 8, '0');
  
  // Unit
  doc.text('4. Unit', MARGIN + 55, formY + 28);
  drawInputField(doc, MARGIN + 55, formY + 30, 40, 8, 'Pieces ▼');
  
  // Rate (readonly)
  doc.text('5. Rate (Auto)', MARGIN + 105, formY + 28);
  setColor(doc, LIGHT_GRAY, 'fill');
  doc.roundedRect(MARGIN + 105, formY + 30, 35, 8, 2, 2, 'F');
  setColor(doc, GRAY, 'text');
  doc.setFontSize(6);
  doc.text('₹25.00', MARGIN + 110, formY + 35);
  
  // Total
  setColor(doc, DARK_BG, 'text');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('6. Line Total', MARGIN + 145, formY + 28);
  setColor(doc, GREEN, 'fill');
  doc.roundedRect(MARGIN + 145, formY + 30, 30, 8, 2, 2, 'F');
  setColor(doc, WHITE, 'text');
  doc.setFontSize(6);
  doc.text('₹250.00', MARGIN + 150, formY + 35);
  
  // Add Row button
  drawButton(doc, MARGIN + 5, formY + 45, 30, 8, '+ Add Row', GRAY);
  
  // Add to Cart button
  drawButton(doc, MARGIN + 130, formY + 45, 45, 8, 'Add to Cart', AMBER);
  
  yPos = formY + 70;
  
  drawSubHeader(doc, 'Field Descriptions');
  drawBullet(doc, 'Product: Search by name or SKU code. Tap to see dropdown of available products.');
  drawBullet(doc, 'Variant: Select size, pack, or flavor. Options depend on selected product.');
  drawBullet(doc, 'Quantity: Enter numeric quantity. Tap field and use keyboard.');
  drawBullet(doc, 'Unit: Choose unit of measure (Pieces, Cases, Boxes, etc.).');
  drawBullet(doc, 'Rate: Automatically populated based on retailer\'s price tier.');
  drawBullet(doc, 'Total: Calculated automatically (Quantity × Rate).');
  
  checkPageBreak(doc, 40);
  drawSubHeader(doc, 'Adding Multiple Products');
  drawStepInstruction(doc, 1, 'Fill in the first product row completely');
  drawStepInstruction(doc, 2, 'Tap "+ Add Row" to add another product line');
  drawStepInstruction(doc, 3, 'Repeat for all products in the order');
  drawStepInstruction(doc, 4, 'When done, tap "Add to Cart" to move items to cart');
  
  // ===== SECTION 6: GRID VIEW =====
  doc.addPage();
  currentPage++;
  yPos = MARGIN;
  
  drawSectionHeader(doc, 'Grid View Order Entry', 6);
  
  drawParagraph(doc, 'Grid View offers a visual, card-based interface perfect for quick ordering. Products display with images, prices, and simple +/- quantity controls.');
  
  yPos += 5;
  drawSubHeader(doc, 'Grid View Interface');
  yPos += 5;
  
  drawGridViewScreen(doc);
  
  drawSubHeader(doc, 'Key Features');
  drawBullet(doc, 'Category Tabs: Filter products by category for faster navigation');
  drawBullet(doc, 'Product Cards: Show product image, name, and price at a glance');
  drawBullet(doc, 'Scheme Indicator: Orange badge shows products with active offers');
  drawBullet(doc, 'Quick Add: Tap + to increase quantity, - to decrease');
  
  drawSubHeader(doc, 'How to Use Grid View');
  drawStepInstruction(doc, 1, 'Select a category tab to filter products (or use "All")');
  drawStepInstruction(doc, 2, 'Scroll through products to find what you need');
  drawStepInstruction(doc, 3, 'Tap the + button to add one unit to cart');
  drawStepInstruction(doc, 4, 'The quantity counter shows current cart quantity');
  drawStepInstruction(doc, 5, 'Tap the scheme badge (%) to view offer details');
  
  // ===== SECTION 7: CART & SUBMIT =====
  doc.addPage();
  currentPage++;
  yPos = MARGIN;
  
  drawSectionHeader(doc, 'Review Cart & Submit Order', 7);
  
  drawParagraph(doc, 'Before submitting, always review your cart to ensure all items are correct. The cart summary shows itemized products, quantities, prices, and applied discounts.');
  
  yPos += 5;
  drawSubHeader(doc, 'Cart Summary Screen');
  yPos += 5;
  
  drawCartScreen(doc);
  
  drawSubHeader(doc, 'Cart Components');
  drawBullet(doc, 'Item List: Each product shows name, quantity, unit price, and line total');
  drawBullet(doc, 'Edit Quantity: Tap item to modify quantity or remove');
  drawBullet(doc, 'Subtotal: Sum of all items before discounts');
  drawBullet(doc, 'Discounts: Scheme discounts automatically applied');
  drawBullet(doc, 'Grand Total: Final order value');
  
  checkPageBreak(doc, 50);
  drawSubHeader(doc, 'Submitting the Order');
  drawStepInstruction(doc, 1, 'Review all items in the cart for accuracy');
  drawStepInstruction(doc, 2, 'Check the total amount matches expectations');
  drawStepInstruction(doc, 3, 'Select payment type if required (Cash, Credit, UPI)');
  drawStepInstruction(doc, 4, 'Tap "Place Order" to submit');
  drawStepInstruction(doc, 5, 'Wait for confirmation screen');
  
  // ===== SECTION 8: CONFIRMATION =====
  doc.addPage();
  currentPage++;
  yPos = MARGIN;
  
  drawSectionHeader(doc, 'Order Confirmation', 8);
  
  drawParagraph(doc, 'After successfully submitting an order, you\'ll see a confirmation screen with the order details and a unique order ID for tracking.');
  
  yPos += 5;
  drawSubHeader(doc, 'Confirmation Screen');
  yPos += 5;
  
  drawConfirmationScreen(doc);
  
  drawSubHeader(doc, 'What Happens Next');
  drawBullet(doc, 'Order ID is generated for tracking purposes');
  drawBullet(doc, 'Order syncs to the server (if online)');
  drawBullet(doc, 'You can view or share the invoice');
  drawBullet(doc, 'Retailer receives order notification');
  drawBullet(doc, 'Order appears in your order history');
  
  drawSubHeader(doc, 'Available Actions');
  drawStepInstruction(doc, 1, 'Tap "View Invoice" to see detailed invoice');
  drawStepInstruction(doc, 2, 'Share invoice via WhatsApp or email');
  drawStepInstruction(doc, 3, 'Return to visits to continue with next retailer');
  
  // ===== SECTION 9: COMMON ERRORS =====
  doc.addPage();
  currentPage++;
  yPos = MARGIN;
  
  drawSectionHeader(doc, 'Common Errors & Solutions', 9);
  
  drawParagraph(doc, 'Here are common issues you might encounter and how to resolve them:');
  
  yPos += 5;
  
  // Error 1
  setColor(doc, { r: 239, g: 68, b: 68 }, 'fill');
  doc.roundedRect(MARGIN, yPos, CONTENT_WIDTH, 25, 3, 3, 'F');
  setColor(doc, WHITE, 'text');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Error: "Product not found"', MARGIN + 5, yPos + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Solution: Check spelling or use product code. Product may be', MARGIN + 5, yPos + 15);
  doc.text('discontinued or not assigned to this retailer\'s price tier.', MARGIN + 5, yPos + 20);
  yPos += 30;
  
  // Error 2
  setColor(doc, { r: 239, g: 68, b: 68 }, 'fill');
  doc.roundedRect(MARGIN, yPos, CONTENT_WIDTH, 25, 3, 3, 'F');
  setColor(doc, WHITE, 'text');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Error: "Minimum order value not met"', MARGIN + 5, yPos + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Solution: Add more items to reach the minimum order value', MARGIN + 5, yPos + 15);
  doc.text('required for this retailer or scheme.', MARGIN + 5, yPos + 20);
  yPos += 30;
  
  // Error 3
  setColor(doc, { r: 239, g: 68, b: 68 }, 'fill');
  doc.roundedRect(MARGIN, yPos, CONTENT_WIDTH, 25, 3, 3, 'F');
  setColor(doc, WHITE, 'text');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Error: "Order sync failed"', MARGIN + 5, yPos + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Solution: Order is saved offline. Sync will retry automatically', MARGIN + 5, yPos + 15);
  doc.text('when connection is restored. Check pending orders section.', MARGIN + 5, yPos + 20);
  yPos += 30;
  
  // Error 4
  setColor(doc, { r: 239, g: 68, b: 68 }, 'fill');
  doc.roundedRect(MARGIN, yPos, CONTENT_WIDTH, 25, 3, 3, 'F');
  setColor(doc, WHITE, 'text');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Error: "Invalid quantity"', MARGIN + 5, yPos + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Solution: Quantity must be a positive number. Check if product', MARGIN + 5, yPos + 15);
  doc.text('has minimum/maximum quantity restrictions.', MARGIN + 5, yPos + 20);
  yPos += 35;
  
  // ===== SECTION 10: BEST PRACTICES =====
  drawSectionHeader(doc, 'Best Practices', 10);
  
  drawBullet(doc, 'Always verify retailer name before starting order entry');
  drawBullet(doc, 'Use Grid View for repeat orders, Table View for complex orders');
  drawBullet(doc, 'Check scheme indicators to maximize retailer discounts');
  drawBullet(doc, 'Review cart summary before submitting');
  drawBullet(doc, 'Use voice order in noisy environments with headphones');
  drawBullet(doc, 'Enable offline mode before entering low-connectivity areas');
  drawBullet(doc, 'Sync pending orders when you return to good network coverage');
  
  // ===== FINAL PAGE: QUICK REFERENCE =====
  doc.addPage();
  currentPage++;
  yPos = MARGIN;
  
  setColor(doc, AMBER, 'fill');
  doc.rect(0, 0, PAGE_WIDTH, 40, 'F');
  
  setColor(doc, WHITE, 'text');
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Quick Reference Card', PAGE_WIDTH / 2, 25, { align: 'center' });
  
  yPos = 50;
  
  // Quick reference table
  const refData = [
    { action: 'Take Order', path: 'My Visits → Retailer → Take Order' },
    { action: 'Table Entry', path: 'Order Entry → Table Tab → Fill Form' },
    { action: 'Grid Entry', path: 'Order Entry → Grid Tab → Tap +' },
    { action: 'Voice Order', path: 'Order Entry → Voice Tab → Tap Mic' },
    { action: 'View Schemes', path: 'Tap % badge on product' },
    { action: 'Add Returns', path: 'Order Entry → Returns Tab' },
    { action: 'Submit Order', path: 'Cart → Review → Place Order' },
    { action: 'View Invoice', path: 'Confirmation → View Invoice' },
  ];
  
  setColor(doc, DARK_BG, 'fill');
  doc.rect(MARGIN, yPos, CONTENT_WIDTH, 8, 'F');
  setColor(doc, WHITE, 'text');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Action', MARGIN + 5, yPos + 5.5);
  doc.text('Navigation Path', MARGIN + 60, yPos + 5.5);
  yPos += 8;
  
  refData.forEach((item, index) => {
    const bgColor = index % 2 === 0 ? { r: 250, g: 250, b: 250 } : WHITE;
    setColor(doc, bgColor, 'fill');
    doc.rect(MARGIN, yPos, CONTENT_WIDTH, 8, 'F');
    
    setColor(doc, DARK_BG, 'text');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(item.action, MARGIN + 5, yPos + 5.5);
    doc.setFont('helvetica', 'normal');
    doc.text(item.path, MARGIN + 60, yPos + 5.5);
    yPos += 8;
  });
  
  // Support info
  yPos += 15;
  setColor(doc, GRAY, 'text');
  doc.setFontSize(9);
  doc.text('Need help? Contact support:', MARGIN, yPos);
  yPos += 8;
  setColor(doc, BLUE, 'text');
  doc.text('support@quickapp.ai | +91 1800-XXX-XXXX', MARGIN, yPos);
  
  // Footer
  setColor(doc, GRAY, 'text');
  doc.setFontSize(8);
  doc.text(`Generated on ${format(new Date(), 'PPpp')}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 10, { align: 'center' });
  
  // Save PDF
  doc.save(`Order-Creation-Guide-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
