/**
 * The text of the public privacy notice (/privacy). Kept here, not only in
 * the seed, so the same text can create the page on a fresh database and be
 * applied to an existing one (scripts/set-privacy-notice.ts). Once published,
 * the department edits it in /admin/pages like any other page.
 *
 * Every statement below describes what this site actually does today. When
 * the site changes (a new form, a new service, a new retention period), this
 * notice must change with it. Written to follow the Nigeria Data Protection
 * Act 2023 in plain language; it is a draft for review by OAU legal or the
 * data protection officer, not a reviewed legal document.
 */
export const PRIVACY_NOTICE_TITLE = "Privacy notice";

/** The first words of the earlier short draft, used to recognise an unedited seed. */
export const OLD_PRIVACY_DRAFT_START = "<p>This notice explains what happens to the information alumni give the department";

export const PRIVACY_NOTICE_BODY =
  "<p>This website is run by the Department of Mathematics, Obafemi Awolowo University, Ile-Ife " +
  "(&ldquo;the department&rdquo;). The department decides what personal information is collected " +
  "through this site and how it is used, which makes it the data controller under the Nigeria Data " +
  "Protection Act 2023. This notice says what we collect, why, who can see it, how long we keep it, " +
  "and what you can ask us to do.</p>" +
  "<h2>Contacting us about your information</h2>" +
  "<p>Use the <a href=\"/contact\">contact page</a> and choose the type that fits (for example Alumni, " +
  "if your question is about the alumni directory). Say what you would like us to do. We will confirm " +
  "who you are before we change or remove anything.</p>" +
  "<p>[PLACEHOLDER - the department needs to add the name and contact details of its data protection " +
  "officer or the person responsible for data protection.]</p>" +
  "<h2>What we collect, and why</h2>" +
  "<h3>If you only browse the site</h3>" +
  "<p>You do not need an account to read the site. We do not use advertising or analytics trackers. " +
  "Like any web server, ours keeps short-term technical logs (such as the time of a request, the " +
  "address it came from and the browser used) so that we can keep the site secure and fix faults.</p>" +
  "<h3>If you send a message through the contact page</h3>" +
  "<ul>" +
  "<li>We collect your name, email address, the type of enquiry, a subject and your message.</li>" +
  "<li>We use it to reply to you. Staff who handle messages can read them.</li>" +
  "<li>The form has hidden spam checks (a field only a robot fills in, and a timer). They do not " +
  "track you.</li>" +
  "</ul>" +
  "<h3>If you fill in the alumni form</h3>" +
  "<ul>" +
  "<li>We collect your name, email address, programme (B.Sc., M.Sc. or Ph.D.), the years you started " +
  "and graduated, current organisation, role, city, country, industry, a short note, an optional photo " +
  "and an optional LinkedIn link.</li>" +
  "<li>We also record that you agreed, with the date, time and wording you agreed to.</li>" +
  "<li>The department checks every entry before it is shown. Nothing appears publicly until it is " +
  "approved, and we only show entries from people who agreed to public display.</li>" +
  "<li>Once approved, your name, programme, graduation year, organisation, role, city, country, " +
  "industry, note, photo and LinkedIn link may appear on the public alumni page. Your email address is " +
  "never shown publicly. We use it only to reach you about your entry and to spot duplicate entries.</li>" +
  "<li>After you submit, the thank-you page may suggest other alumni from around your graduating year " +
  "who are already in the directory. It shows only the details already public.</li>" +
  "</ul>" +
  "<h3>If you create a journal account, submit a paper or review one</h3>" +
  "<ul>" +
  "<li>Authors give their name and email address, and for each manuscript the titles, abstracts, " +
  "files and details of every author (name, affiliation, email and, if given, ORCID). We email you to " +
  "confirm your address and to tell you about the progress of a submission.</li>" +
  "<li>Reviewers give their name and email address and write reports and recommendations. Reviews are " +
  "double blind: the journal does not show a reviewer&rsquo;s identity to authors, or the authors&rsquo; " +
  "identities to reviewers, while a paper is being reviewed.</li>" +
  "<li>Manuscripts and review reports are private. They are stored away from the public website and " +
  "only the people involved in handling that paper can open them.</li>" +
  "<li>When an article is published, the authors&rsquo; names and affiliations (and ORCID, if given) " +
  "are published with it. A reviewer&rsquo;s name appears on the public acknowledgement page only if " +
  "the reviewer chooses to be listed.</li>" +
  "</ul>" +
  "<h3>If you are a lecturer, staff member or administrator</h3>" +
  "<ul>" +
  "<li>We keep your name, email address, role and the time of your last sign-in. Your password is " +
  "stored in a scrambled form that nobody, including us, can read back.</li>" +
  "<li>A lecturer&rsquo;s public profile shows what the lecturer or an administrator chooses to " +
  "publish, such as a photo, biography, contact details, publications and courses.</li>" +
  "<li>Actions taken in the admin area are recorded (who did what, when, and the address and browser " +
  "used) so that changes can be traced and mistakes undone.</li>" +
  "</ul>" +
  "<h2>Cookies</h2>" +
  "<p>The site uses only the cookies it needs to work. When you sign in, a session cookie keeps you " +
  "signed in for up to 12 hours; short-lived security cookies protect the sign-in form. We do not use " +
  "advertising or analytics cookies. If you never sign in, these cookies are not used for you.</p>" +
  "<h2>Services that help us run the site</h2>" +
  "<ul>" +
  "<li><strong>Cloudinary</strong> stores and delivers the public images and PDF files shown on the " +
  "site. When you view a page with such images, your browser fetches them from Cloudinary.</li>" +
  "<li><strong>Resend</strong> sends the emails the site sends (invitations, password resets, email " +
  "confirmation and journal notices). It sees the recipient&rsquo;s email address and the message.</li>" +
  "<li><strong>Our hosting provider</strong> runs the server that holds the website&rsquo;s database " +
  "and the private manuscript files.</li>" +
  "</ul>" +
  "<p>These services may process information outside Nigeria. We share only what each one needs to do " +
  "its job and we do not sell personal information.</p>" +
  "<p>[PLACEHOLDER - OAU legal or the data protection officer should confirm the wording about " +
  "transfers outside Nigeria and name any further safeguards required.]</p>" +
  "<h2>How long we keep information</h2>" +
  "<ul>" +
  "<li><strong>Alumni entries that are not approved:</strong> 90 days, in case you want to correct " +
  "and resubmit, then permanently deleted along with any photo.</li>" +
  "<li><strong>Approved alumni entries:</strong> until you ask us to correct or remove them.</li>" +
  "<li><strong>Contact messages:</strong> until a staff member archives them, then 12 months, then " +
  "permanently deleted.</li>" +
  "<li><strong>Journal drafts that were never submitted:</strong> deleted after 60 days without " +
  "activity.</li>" +
  "<li><strong>Submitted manuscripts, reviews, decisions and published articles:</strong> kept " +
  "permanently as the journal&rsquo;s editorial record.</li>" +
  "<li><strong>Accounts:</strong> for as long as the account is needed. Ask us to close yours at any " +
  "time.</li>" +
  "<li><strong>Backups:</strong> we keep regular backups so the site can be recovered. Information we " +
  "have deleted can remain in a backup for up to 14 days.</li>" +
  "</ul>" +
  "<p>[PLACEHOLDER - the department needs to confirm how long it keeps the admin activity record and " +
  "the server logs, and whether permanent retention of submitted manuscripts is acceptable. OAU legal " +
  "should review both.]</p>" +
  "<h2>Your rights</h2>" +
  "<p>Under the Nigeria Data Protection Act 2023 you can ask us to:</p>" +
  "<ul>" +
  "<li>tell you what personal information we hold about you and give you a copy;</li>" +
  "<li>correct information that is wrong or out of date;</li>" +
  "<li>delete your information, where we have no good reason to keep it;</li>" +
  "<li>stop or limit how we use it, or object to a use you do not agree with;</li>" +
  "<li>give you your information in a form you can move elsewhere; and</li>" +
  "<li>withdraw a consent you gave, for example for your alumni entry. Withdrawing does not affect what " +
  "we did before you withdrew.</li>" +
  "</ul>" +
  "<p>Some information, such as published articles and the journal&rsquo;s editorial record, cannot be " +
  "removed on request because we must keep it; we will tell you if that applies. If you are not happy " +
  "with how we have handled your information, you can complain to the Nigeria Data Protection " +
  "Commission.</p>" +
  "<h2>How we protect it</h2>" +
  "<ul>" +
  "<li>The site is served over an encrypted connection (HTTPS).</li>" +
  "<li>Sign-in attempts are limited, and what a signed-in person can do depends on their role.</li>" +
  "<li>Private files are kept away from the public website and are only given to people allowed to " +
  "see them.</li>" +
  "<li>Alumni entries stay hidden until the department approves them.</li>" +
  "</ul>" +
  "<h2>Changes to this notice</h2>" +
  "<p>We will update this notice when what we collect or how we use it changes. The date at the top of " +
  "this page shows when it was last changed.</p>" +
  "<p>[PLACEHOLDER - this notice is a plain-language draft, not a reviewed legal document. It needs " +
  "review by OAU legal or the data protection officer before launch.]</p>";
