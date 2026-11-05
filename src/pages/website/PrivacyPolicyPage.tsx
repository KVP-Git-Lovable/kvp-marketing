import { WebsiteHeader } from "@/components/website/WebsiteHeader";
import { WebsiteFooter } from "@/components/website/WebsiteFooter";

const PrivacyPolicyPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <WebsiteHeader />
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-10">Effective Date: April 1, 2025 | Last Updated: April 1, 2025</p>

        <div className="space-y-10 text-foreground/90 leading-relaxed">
          {/* 1. Introduction */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Introduction</h2>
            <p>
              QuickApp.AI ("we", "our", or "us") is an AI-powered field sales automation platform operated from Bangalore, India. 
              This Privacy Policy explains how we collect, use, store, and protect your personal and business data when you use 
              our platform, including our web application, mobile apps, and progressive web app (PWA).
            </p>
            <p className="mt-2">
              By accessing or using QuickApp.AI, you agree to the terms of this Privacy Policy. If you do not agree, 
              please discontinue use of our services.
            </p>
          </section>

          {/* 2. Information We Collect */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Information We Collect</h2>
            
            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">2.1 Account Information</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Full name, email address, phone number</li>
              <li>Company name, designation, and team/territory assignment</li>
              <li>Profile photo (used for face verification during attendance)</li>
              <li>Login credentials (passwords are securely hashed and never stored in plain text)</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">2.2 Field Sales & Operational Data</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>GPS location data (captured during attendance check-in/check-out and retailer visits)</li>
              <li>Visit logs, beat plans, and route information</li>
              <li>Orders, invoices, payment collections, and expense claims</li>
              <li>Retailer information (store name, address, contact, category)</li>
              <li>Photos (stock images, shelf displays, competition boards, branding assets)</li>
              <li>Voice notes and audio recordings submitted during visits</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">2.3 Device & Technical Data</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Device type, operating system, and browser information</li>
              <li>IP address and approximate network location</li>
              <li>App version and crash/performance logs</li>
              <li>Offline sync status and local storage usage</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">2.4 Usage Analytics</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Feature usage patterns and session duration</li>
              <li>Module access frequency and interaction events</li>
              <li>AI feature engagement (coaching, recommendations, insights)</li>
            </ul>
          </section>

          {/* 3. How We Use Your Information */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Service Delivery:</strong> To provide field sales automation, beat planning, order management, and retailer management features.</li>
              <li><strong>AI-Powered Features:</strong> To generate intelligent sales recommendations, stock analysis from photos, credit scoring, route optimization, and personalized coaching.</li>
              <li><strong>Analytics & Reporting:</strong> To provide real-time dashboards, performance reports, and business intelligence to your organization's administrators.</li>
              <li><strong>Attendance & Verification:</strong> To verify field attendance using GPS location and face recognition.</li>
              <li><strong>Communication:</strong> To send notifications, alerts, and updates via push notifications, WhatsApp, or SMS.</li>
              <li><strong>Security:</strong> To detect unauthorized access, prevent fraud, and maintain audit trails.</li>
              <li><strong>Product Improvement:</strong> To analyze usage patterns and improve our platform's features and user experience.</li>
            </ul>
          </section>

          {/* 4. Data Sharing */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Data Sharing & Third Parties</h2>
            <p className="mb-3">
              We do <strong>not sell</strong> your personal data to any third party. We may share data with the following service providers strictly for platform operation:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Supabase:</strong> Cloud database hosting, authentication, and real-time data synchronization.</li>
              <li><strong>Map Services:</strong> For GPS-based route optimization and location verification.</li>
              <li><strong>WhatsApp Business API:</strong> For sending order confirmations, visit reminders, and notifications.</li>
              <li><strong>Firebase:</strong> For crash reporting and performance monitoring on mobile apps.</li>
              <li><strong>AI Processing:</strong> Image and text data may be processed by AI models to generate insights (e.g., stock analysis, board scanning). This data is not used to train third-party models.</li>
            </ul>
            <p className="mt-3">
              Your organization's administrators may access aggregated and individual performance data of their team members as part of the platform's management features.
            </p>
          </section>

          {/* 5. Data Storage & Security */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Data Storage & Security</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>All data is encrypted in transit (TLS 1.2+) and at rest.</li>
              <li>Our infrastructure is hosted on secure cloud services with ISO 27001 compliance.</li>
              <li>Role-based access control (RBAC) ensures users only access data relevant to their role and territory.</li>
              <li>Offline data is stored locally on the device using encrypted storage and synced securely when connectivity is restored.</li>
              <li>Regular security audits and vulnerability assessments are performed.</li>
              <li>Row-level security (RLS) policies are enforced at the database level.</li>
            </ul>
          </section>

          {/* 6. GPS & Location Data */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. GPS & Location Data</h2>
            <p className="mb-3">We collect GPS location data for the following purposes:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Attendance Verification:</strong> Location is captured at check-in and check-out to verify field presence.</li>
              <li><strong>Visit Verification:</strong> GPS coordinates are recorded when a visit to a retailer is started and completed.</li>
              <li><strong>Route Optimization:</strong> Location data helps generate optimized travel routes between retailer locations.</li>
              <li><strong>Geo-fencing:</strong> To verify that visits occur at the correct retailer location.</li>
            </ul>
            <p className="mt-3">
              Location data is collected only when the app is actively in use (not in the background). 
              You may deny location permissions, but this will limit certain features like attendance and visit tracking.
            </p>
          </section>

          {/* 7. Photo & Image Data */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Photo & Image Data</h2>
            <p className="mb-3">Photos captured through the platform are used for:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Stock Analysis:</strong> AI-powered image analysis to assess shelf stock levels and product availability.</li>
              <li><strong>Competition Monitoring:</strong> Photos of competitor displays and pricing boards for market intelligence.</li>
              <li><strong>Board Scanning:</strong> Automated extraction of pricing and product data from retailer boards.</li>
              <li><strong>Branding Verification:</strong> Before/after photos of branding asset installation at retail outlets.</li>
              <li><strong>Face Verification:</strong> Profile photos matched during attendance check-in for identity verification.</li>
            </ul>
            <p className="mt-3">
              Photos are stored securely and retained for the duration of the business relationship. 
              AI processing of images is done solely to provide platform features and is not used to train external AI models.
            </p>
          </section>

          {/* 8. Cookies & Tracking */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Cookies & Tracking</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Session Cookies:</strong> Used to maintain your login session and authentication state.</li>
              <li><strong>PWA Storage:</strong> Service workers and local storage are used for offline functionality and data caching.</li>
              <li><strong>Analytics:</strong> We collect anonymized usage metrics to understand feature adoption and improve the platform.</li>
            </ul>
            <p className="mt-3">
              We do not use third-party advertising cookies or tracking pixels. No data is shared with ad networks.
            </p>
          </section>

          {/* 9. Data Retention */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Data Retention</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Active account data is retained for the duration of your organization's subscription.</li>
              <li>Upon account termination, personal data is deleted within 90 days, unless legally required to retain it.</li>
              <li>Anonymized and aggregated data may be retained for analytics and product improvement purposes.</li>
              <li>Audit logs are retained for a minimum of 1 year for compliance purposes.</li>
              <li>Offline cached data is cleared when the user logs out or the app is uninstalled.</li>
            </ul>
          </section>

          {/* 10. Your Rights */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">10. Your Rights</h2>
            <p className="mb-3">
              Depending on your jurisdiction, you may have the following rights regarding your personal data:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Right to Access:</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong>Right to Correction:</strong> Request correction of inaccurate or incomplete data.</li>
              <li><strong>Right to Deletion:</strong> Request deletion of your personal data, subject to legal obligations.</li>
              <li><strong>Right to Data Portability:</strong> Request your data in a structured, machine-readable format.</li>
              <li><strong>Right to Withdraw Consent:</strong> Withdraw consent for data processing at any time (may affect service availability).</li>
              <li><strong>Right to Object:</strong> Object to processing of your data for specific purposes.</li>
            </ul>
            <p className="mt-3">
              These rights are provided in alignment with the Information Technology Act, 2000 (India), 
              the Digital Personal Data Protection Act, 2023 (India), and the General Data Protection Regulation (GDPR) 
              for users in the European Economic Area.
            </p>
            <p className="mt-2">
              To exercise any of these rights, contact us at <strong>hello@quickapp.ai</strong>.
            </p>
          </section>

          {/* 11. Children's Privacy */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">11. Children's Privacy</h2>
            <p>
              QuickApp.AI is a B2B platform designed for business use by adults. We do not knowingly collect personal 
              data from individuals under the age of 18. If we become aware that data has been collected from a minor, 
              we will take steps to delete it promptly.
            </p>
          </section>

          {/* 12. Changes to This Policy */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">12. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time to reflect changes in our practices, technology, 
              or legal requirements. When we make significant changes, we will notify users through the platform 
              or via email. The "Last Updated" date at the top of this page indicates when the policy was last revised.
            </p>
          </section>

          {/* 13. Contact Us */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">13. Contact Us</h2>
            <p className="mb-3">
              If you have any questions, concerns, or requests regarding this Privacy Policy or your personal data, 
              please contact us:
            </p>
            <ul className="list-none space-y-2">
              <li className="flex items-center gap-2">
                <strong>Email:</strong> <a href="mailto:hello@quickapp.ai" className="text-accent-gold hover:underline">hello@quickapp.ai</a>
              </li>
              <li className="flex items-center gap-2">
                <strong>Phone:</strong> +91 63616 80976
              </li>
              <li className="flex items-center gap-2">
                <strong>Address:</strong> Bangalore, Karnataka, India
              </li>
            </ul>
          </section>
        </div>
      </main>
      <WebsiteFooter />
    </div>
  );
};

export default PrivacyPolicyPage;
