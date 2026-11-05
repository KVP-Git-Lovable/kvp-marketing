import { format, addWeeks } from 'date-fns';
import { ImplementationData } from '@/pages/website/ImplementationToolkitPage';

export async function generateImplementationPDF(data: ImplementationData): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  let yPos = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;

  const addPage = () => {
    doc.addPage();
    yPos = 20;
  };

  const checkPageBreak = (height: number) => {
    if (yPos + height > 270) {
      addPage();
    }
  };

  const drawHeader = (text: string, size: number = 16) => {
    checkPageBreak(15);
    doc.setFontSize(size);
    doc.setTextColor(245, 158, 11); // Amber
    doc.setFont('helvetica', 'bold');
    doc.text(text, margin, yPos);
    yPos += 8;
    doc.setDrawColor(245, 158, 11);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
  };

  const drawSubHeader = (text: string) => {
    checkPageBreak(10);
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'bold');
    doc.text(text, margin, yPos);
    yPos += 6;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
  };

  const drawText = (label: string, value: string, indent: number = 0) => {
    checkPageBreak(8);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, margin + indent, yPos);
    doc.setFont('helvetica', 'normal');
    const labelWidth = doc.getTextWidth(`${label}: `);
    doc.text(value || 'Not specified', margin + indent + labelWidth, yPos);
    yPos += 6;
  };

  const drawBullet = (text: string, indent: number = 5) => {
    checkPageBreak(8);
    doc.setFontSize(10);
    doc.text('•', margin + indent, yPos);
    const lines = doc.splitTextToSize(text, contentWidth - indent - 10);
    doc.text(lines, margin + indent + 5, yPos);
    yPos += lines.length * 5 + 2;
  };

  // Cover Page
  doc.setFillColor(26, 31, 44);
  doc.rect(0, 0, pageWidth, 297, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('Quickapp Implementation', pageWidth / 2, 80, { align: 'center' });
  
  doc.setFontSize(22);
  doc.setTextColor(245, 158, 11);
  doc.text('Requirement Analysis &', pageWidth / 2, 100, { align: 'center' });
  doc.text('Project Planning Document', pageWidth / 2, 115, { align: 'center' });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.text(data.companyProfile.companyName || 'Customer Name', pageWidth / 2, 150, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(180, 180, 180);
  doc.text(format(new Date(), 'MMMM dd, yyyy'), pageWidth / 2, 170, { align: 'center' });

  doc.setFontSize(10);
  doc.text('Prepared by Quickapp.ai', pageWidth / 2, 250, { align: 'center' });
  doc.text('AI-Forward Commerce Platform', pageWidth / 2, 260, { align: 'center' });

  // Page 2: Company Profile
  addPage();
  doc.setTextColor(0, 0, 0);
  
  drawHeader('1. Company Profile');
  drawText('Company Name', data.companyProfile.companyName);
  drawText('Industry', data.companyProfile.industry);
  drawText('Headquarters', data.companyProfile.headquarters);
  drawText('States/Regions Covered', data.companyProfile.statesRegions);
  drawText('Annual Revenue', data.companyProfile.annualRevenue);
  drawText('Number of Distributors', data.companyProfile.distributorCount);
  drawText('Number of Sales Representatives', data.companyProfile.salesRepCount);
  drawText('Number of Retailers', data.companyProfile.retailerCount);
  yPos += 5;
  drawSubHeader('Current Technology Stack');
  const techLines = doc.splitTextToSize(data.companyProfile.currentTechStack || 'Not specified', contentWidth);
  doc.text(techLines, margin, yPos);
  yPos += techLines.length * 5 + 5;

  // Current State Assessment
  yPos += 10;
  drawHeader('2. Current State Assessment');
  
  drawSubHeader('Sales Force Operations');
  drawText('Beat Planning Process', data.salesOperations.beatPlanningProcess);
  drawText('Visit Tracking', data.salesOperations.visitTracking);
  drawText('Average Visits/Day', data.salesOperations.averageVisitsPerDay);
  drawText('Attendance Management', data.salesOperations.attendanceManagement);
  drawText('GPS Tracking', data.salesOperations.gpsTracking);
  if (data.salesOperations.reportsSubmitted.length > 0) {
    drawText('Reports Submitted', data.salesOperations.reportsSubmitted.join(', '));
  }

  yPos += 5;
  drawSubHeader('Order Management');
  drawText('Order Capture Process', data.orderManagement.orderCaptureProcess);
  drawText('Order Capture Time', data.orderManagement.orderCaptureTime);
  drawText('Order to Delivery Time', data.orderManagement.orderToDeliveryTime);
  drawText('Pricing Tiers', data.orderManagement.pricingTiers);

  checkPageBreak(50);
  yPos += 5;
  drawSubHeader('Distributor Network');
  drawText('Active Distributors', data.distributorNetwork.activeDistributors);
  drawText('Primary Order Process', data.distributorNetwork.primaryOrderProcess);
  drawText('Inventory Tracking', data.distributorNetwork.inventoryTracking);
  drawText('Secondary Sales Visibility', data.distributorNetwork.secondarySalesVisibility);

  // Pain Points
  addPage();
  drawHeader('3. Pain Points & Challenges');
  
  const highPriorityPains = data.painPoints.filter(p => p.priority === 'high');
  const mediumPriorityPains = data.painPoints.filter(p => p.priority === 'medium');
  
  if (highPriorityPains.length > 0) {
    drawSubHeader('High Priority');
    highPriorityPains.forEach(pain => {
      if (pain.challenge) {
        drawBullet(`${pain.area}: ${pain.challenge}${pain.impact ? ` (Impact: ${pain.impact})` : ''}`);
      }
    });
  }

  if (mediumPriorityPains.length > 0) {
    yPos += 5;
    drawSubHeader('Medium Priority');
    mediumPriorityPains.forEach(pain => {
      if (pain.challenge) {
        drawBullet(`${pain.area}: ${pain.challenge}`);
      }
    });
  }

  // Feature Mapping
  addPage();
  drawHeader('4. Feature Mapping');

  const selectedFeatures = Object.entries(data.featureMapping).filter(([_, v]) => v.required);
  const criticalFeatures = selectedFeatures.filter(([_, v]) => v.priority === 'critical');
  const highFeatures = selectedFeatures.filter(([_, v]) => v.priority === 'high');
  const otherFeatures = selectedFeatures.filter(([_, v]) => v.priority !== 'critical' && v.priority !== 'high');

  if (criticalFeatures.length > 0) {
    drawSubHeader('Critical Features');
    criticalFeatures.forEach(([feature, mapping]) => {
      drawBullet(`${feature}${mapping.notes ? ` - ${mapping.notes}` : ''}`);
    });
  }

  if (highFeatures.length > 0) {
    yPos += 5;
    drawSubHeader('High Priority Features');
    highFeatures.forEach(([feature, mapping]) => {
      drawBullet(`${feature}${mapping.notes ? ` - ${mapping.notes}` : ''}`);
    });
  }

  if (otherFeatures.length > 0) {
    yPos += 5;
    drawSubHeader('Other Features');
    otherFeatures.forEach(([feature]) => {
      drawBullet(feature);
    });
  }

  // Data Migration
  checkPageBreak(80);
  yPos += 10;
  drawHeader('5. Data Migration Plan');

  const migrationEntities = data.dataMigration.filter(d => d.sourceSystem || d.recordCount);
  if (migrationEntities.length > 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Entity', margin, yPos);
    doc.text('Source', margin + 50, yPos);
    doc.text('Records', margin + 90, yPos);
    doc.text('Format', margin + 120, yPos);
    doc.text('Priority', margin + 150, yPos);
    yPos += 5;
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 5;

    doc.setFont('helvetica', 'normal');
    migrationEntities.forEach(entity => {
      checkPageBreak(8);
      doc.text(entity.entity.substring(0, 20), margin, yPos);
      doc.text(entity.sourceSystem.substring(0, 15), margin + 50, yPos);
      doc.text(entity.recordCount, margin + 90, yPos);
      doc.text(entity.format, margin + 120, yPos);
      doc.text(entity.priority.toUpperCase(), margin + 150, yPos);
      yPos += 6;
    });
  }

  // Project Timeline
  addPage();
  drawHeader('6. Project Timeline');

  if (data.projectPlan.startDate && data.projectPlan.phases.length > 0) {
    drawText('Project Start Date', format(new Date(data.projectPlan.startDate), 'MMMM dd, yyyy'));
    const totalWeeks = data.projectPlan.phases.reduce((sum, p) => sum + (p.duration || 0), 0);
    drawText('Total Duration', `${totalWeeks} weeks`);
    drawText('Estimated End Date', format(addWeeks(new Date(data.projectPlan.startDate), totalWeeks), 'MMMM dd, yyyy'));

    yPos += 10;
    drawSubHeader('Phase Breakdown');
    
    data.projectPlan.phases.forEach((phase, index) => {
      checkPageBreak(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Phase ${index + 1}: ${phase.name}`, margin, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(`${phase.duration} week(s)`, margin + 80, yPos);
      if (phase.startDate && phase.endDate) {
        doc.setTextColor(100, 100, 100);
        doc.text(`${format(new Date(phase.startDate), 'MMM dd')} - ${format(new Date(phase.endDate), 'MMM dd')}`, margin + 110, yPos);
        doc.setTextColor(0, 0, 0);
      }
      yPos += 7;
    });
  } else {
    doc.text('Project timeline not configured. Please set start date in Project Plan tab.', margin, yPos);
    yPos += 10;
  }

  // Estimation Summary
  yPos += 10;
  drawHeader('7. Estimation Summary');
  
  drawText('Team Size', data.estimation.teamSize.toString());
  drawText('Number of Distributors', data.estimation.distributorCount.toString());
  drawText('Number of Retailers', data.estimation.retailerCount.toString());
  drawText('Modules Selected', data.estimation.modulesSelected.length.toString());
  drawText('Integration Complexity', data.estimation.integrationComplexity);
  drawText('Data Migration Volume', data.estimation.dataMigrationVolume);
  drawText('Training Locations', data.estimation.trainingLocations.toString());
  yPos += 5;
  doc.setFont('helvetica', 'bold');
  drawText('Total Effort', `${data.estimation.totalEffort} person-days`);
  drawText('Timeline', `${data.estimation.timeline} weeks`);
  drawText('Recommended Tier', data.estimation.pricing);
  doc.setFont('helvetica', 'normal');

  // Training Plan
  addPage();
  drawHeader('8. Training Plan');

  drawSubHeader('Training Batches');
  data.training.batches.forEach(batch => {
    checkPageBreak(10);
    doc.setFont('helvetica', 'bold');
    doc.text(batch.name, margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(`${batch.audience} | ${batch.duration} | ${batch.mode} | Status: ${batch.status}`, margin + 30, yPos);
    yPos += 7;
  });

  yPos += 10;
  drawSubHeader('Regional Rollout');
  data.training.regions.forEach(region => {
    if (region.name || region.userCount > 0) {
      checkPageBreak(10);
      doc.text(`${region.name}: ${region.userCount} users | ${region.trainingDate || 'TBD'} | ${region.status}`, margin, yPos);
      yPos += 6;
    }
  });

  // ROI Metrics
  addPage();
  drawHeader('9. Success Metrics');

  drawSubHeader('Baseline vs Target Metrics');
  const metricLabels: Record<string, string> = {
    beatCompliance: 'Beat Compliance (%)',
    orderAccuracy: 'Order Accuracy (%)',
    retailerCoverage: 'Retailer Coverage (%)',
    collectionEfficiency: 'Collection Efficiency (%)',
    reportGenerationTime: 'Report Generation Time (hrs)',
    productiveCalls: 'Productive Calls/Day',
  };

  Object.entries(metricLabels).forEach(([key, label]) => {
    const baseline = data.roiMetrics.baseline[key];
    const target = data.roiMetrics.target[key];
    if (baseline || target) {
      checkPageBreak(8);
      doc.text(`${label}: Baseline: ${baseline || '-'} → Target: ${target || '-'}`, margin, yPos);
      yPos += 6;
    }
  });

  // Footer on last page
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated by Quickapp Implementation Toolkit | ${format(new Date(), 'PPpp')}`, pageWidth / 2, 285, { align: 'center' });

  // Save the PDF
  const fileName = `Quickapp-Implementation-${data.companyProfile.companyName || 'Project'}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  doc.save(fileName);
}
