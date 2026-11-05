'use strict';
/** Demo data: company, recruiters, jobs, candidates (scored by the Python matcher), interviews, messages. */
const db = require('./db');
const sec = require('./lib/security');
const matcher = require('./services/matcher');
const U = require('./lib/util');

const JOBS = [
  ['Senior Frontend Engineer', 'Engineering', 'Chennai, India', 'Hybrid', ['React', 'TypeScript', 'Next.js', 'Design Systems', 'Testing', 'Node.js'], 5, 10, 1800000, 3000000, true],
  ['Senior UX Designer', 'Product', 'Bengaluru, India', 'Hybrid', ['Figma', 'User Research', 'Prototyping', 'Design Systems', 'Wireframing'], 4, 8, 1500000, 2500000, true],
  ['Full Stack Developer', 'Core Product', 'Remote', 'Remote', ['JavaScript', 'React', 'Node.js', 'Express', 'MySQL', 'REST APIs'], 2, 5, 900000, 1600000, false],
  ['Lead Data Engineer', 'Infrastructure', 'Remote', 'Remote', ['Python', 'Apache Spark', 'Airflow', 'SQL', 'AWS', 'Kafka'], 6, 12, 2500000, 4000000, false],
  ['Junior Data Analyst (Graduate)', 'Data', 'Chennai, India', 'On-site', ['SQL', 'Excel', 'Python', 'Power BI', 'Statistics'], 0, 2, 400000, 650000, false],
  ['Growth Marketing Lead', 'Marketing', 'Mumbai, India', 'Hybrid', ['Growth Marketing', 'SEO', 'Google Analytics', 'A/B Testing', 'Content Marketing'], 4, 8, 1400000, 2200000, false],
];

const PEOPLE = [
  ['Alexander Pierce', 0, 'Senior Frontend Engineer', 'TechFlow Systems', 8, 'React, Next.js, TypeScript, JavaScript, CSS, Tailwind CSS, Design Systems, Web Performance, Jest, Git, Agile, Mentoring', 'Technical University of Berlin', 'interview'],
  ['Priya Raman', 0, 'Frontend Developer', 'Nimbus Labs', 4, 'React, JavaScript, Redux, HTML, CSS, REST APIs, Git', 'Anna University', 'screening'],
  ['Arjun Mehta', 0, 'UI Engineer', 'Pixelcraft Studio', 6, 'React, TypeScript, Storybook, Design Systems, Accessibility, Cypress testing, Node.js', 'IIT Madras', 'shortlisted'],
  ['Sophia Martinez', 1, 'UX Designer', 'Brightline Analytics', 6, 'Figma, User Research, Usability testing, Prototyping, Wireframing, Design Systems, Information Architecture', 'Carnegie Mellon University', 'interview'],
  ['Maria Gonzalez', 1, 'Product Designer', 'Orbit Health', 5, 'Figma, Sketch, Prototyping, Visual design, Wireframing', 'NID Ahmedabad Institute', 'interview'],
  ['Karthik Subramanian', 1, 'Graphic Designer', 'Zenith Media', 3, 'Photoshop, Illustrator, Visual design, Branding', 'SRM Institute of Science and Technology', 'applied'],
  ['Elena Rodriguez', 2, 'Full Stack Developer', 'CloudNest', 4, 'JavaScript, React, Node.js, Express, MySQL, REST APIs, Docker, Git', 'VIT Vellore', 'offer'],
  ['Rahul Verma', 2, 'Backend Developer', 'NovaPay', 3, 'Node.js, Express, MongoDB, REST APIs, JavaScript', 'NIT Trichy', 'screening'],
  ['Divya Krishnan', 2, 'Software Engineer', 'Kite Logistics', 2, 'Java, Spring Boot, MySQL, HTML, CSS', 'SRM Institute of Science and Technology', 'applied'],
  ['David Wilson', 3, 'Senior Data Engineer', 'DataHarbor', 9, 'Python, Apache Spark, Airflow, SQL, AWS, Kafka, dbt, Data Modeling, Team Leadership', 'Georgia Tech', 'interview'],
  ['Jameson Burke', 3, 'Data Scientist', 'DeepGrid Labs', 12, 'Python, PyTorch, Machine Learning, SQL, Distributed systems, Statistics', 'Stanford University', 'shortlisted'],
  ['Ananya Iyer', 4, 'B.Tech IT Graduate', 'Leo Club Hopeville (volunteer)', 0, 'SQL, Excel, Python, Power BI, Statistics, Communication', 'SRM Institute of Science and Technology', 'applied'],
  ['Mohammed Faizal', 4, 'Data Analyst Intern', 'Quanta Retail', 1, 'Excel, SQL, Tableau, Data Analysis', 'Anna University', 'screening'],
  ['Sneha Pillai', 4, 'B.Sc Statistics Graduate', 'Freelance', 0, 'Excel, Statistics, R programming, Communication', 'Madras Christian College', 'applied'],
  ['Jane Okafor', 5, 'Growth Marketing Manager', 'GreenLeaf Commerce', 6, 'Growth Marketing, SEO, Google Analytics, A/B Testing, Email Marketing, Content Marketing', 'University of Toronto', 'shortlisted'],
  ['Vikram Shah', 5, 'Digital Marketing Executive', 'Sparrow AI', 3, 'Social Media, SEO, Copywriting, Google Ads', 'Christ University', 'rejected'],
];

function resume([name, , title, company, years, skills, uni]) {
  const slug = name.toLowerCase().replace(/[^a-z]+/g, '');
  const sk = skills.split(', ');
  return `${name}
${title} | India | ${slug}@example.com | +91 98${String(slug.length * 7919).padStart(8, '0').slice(0, 8)} | linkedin.com/in/${slug}

SUMMARY
${title} with ${years ? years + '+ years of experience' : 'strong academic and project experience'} working with ${sk.slice(0, 3).join(', ')}. Focused on delivering measurable results for users and teams.

EXPERIENCE
${title} - ${company} (${2026 - Math.max(1, Math.min(years, 4))} - Present)
- Delivered ${sk[0]} work used by ${10 + years * 5} internal teams and over ${years + 1}00,000 users
- Improved key performance metrics by ${15 + years * 3}% through ${sk[1] || sk[0]} and ${sk[2] || sk[0]}
- Collaborated with cross-functional teams in an Agile environment
${years > 4 ? `Previous role - Bluebird Software (${2026 - years} - ${2026 - 4})\n- Built and maintained products using ${sk.slice(3, 6).join(', ')}\n- Mentored 3 junior colleagues` : '- Completed 2 projects end to end, from requirements to deployment'}

EDUCATION
B.Tech / Bachelor's degree, ${uni} (${2026 - years - 1})

SKILLS
${skills}`;
}

async function seed() {
  const now = Date.now();
  const iso = (d) => new Date(now + d * 86400000).toISOString();
  console.log('Seeding demo data…');
  const cid = await db.insert('companies', {
    name: 'Lumina Systems', slug: 'lumina-systems', industry: 'Software & AI', location: 'Chennai, India', website: 'https://lumina.example.com',
    employees: 850, founded_year: 2018, about: 'Lumina Systems builds practical AI tools for growing businesses and partners with community groups to open careers to first-generation job seekers.',
    mission: 'Hire on skills, keep every candidate informed.', company_values: ['Prioritize integrity in every algorithm', 'Foster radical transparency within teams', 'Design for human flourishing'],
    currency: 'INR', hiring_goal: 10, verified: 1, careers_enabled: 1, is_demo: 1, created_at: iso(-120),
  });
  const pw = sec.hashPassword('demo1234');
  const sarah = await db.insert('recruiters', { company_id: cid, name: 'Sarah Jenkins', email: 'sarah.jenkins@example.com', password_hash: pw, role: 'admin', title: 'Lead Recruiter', status: 'active', created_at: iso(-120) });
  const marcus = await db.insert('recruiters', { company_id: cid, name: 'Marcus Chen', email: 'marcus.chen@example.com', password_hash: pw, role: 'hiring_manager', title: 'Engineering Manager', status: 'active', created_at: iso(-110) });
  const jobIds = [];
  for (const [i, j] of JOBS.entries()) {
    jobIds.push(await db.insert('jobs', {
      company_id: cid, recruiter_id: i % 2 ? marcus : sarah, title: j[0], department: j[1], location: j[2], work_mode: j[3], employment_type: 'Full-time',
      skills: j[4], experience_min: j[5], experience_max: j[6], salary_min: j[7], salary_max: j[8], is_urgent: j[9] ? 1 : 0, openings: 1, status: 'published',
      description: `Lumina Systems is hiring a ${j[0]} to join our ${j[1]} team. You will work with ${j[4].slice(0, 3).join(', ')} to build products used by thousands of small businesses, and help us keep hiring fair and skill-based.`,
      requirements: j[4].map((s) => `- Hands-on experience with ${s}`).join('\n') + `\n- ${j[5]}+ years of relevant experience`,
      created_at: iso(-60 + i * 5), published_at: iso(-60 + i * 5), updated_at: iso(-10),
    }));
  }
  const jobs = await db.all('SELECT * FROM jobs WHERE company_id = ?', [cid]);
  const byId = Object.fromEntries(jobs.map((j) => [j.id, j]));
  const results = await matcher.matchMany(PEOPLE.map((p, i) => ({ id: i, resume_text: resume(p), job: byId[jobIds[p[1]]] })));
  const sources = ['LinkedIn', 'Careers Page', 'Referral', 'Naukri', 'Leo Club job drive'];
  for (const [i, p] of PEOPLE.entries()) {
    const m = results.find((r) => r.id === i);
    const created = iso(-40 + i * 2);
    const candId = await db.insert('candidates', {
      company_id: cid, name: p[0], email: m.contact.email, phone: m.contact.phone, location: 'India', current_title: p[2], current_company: p[3],
      experience_years: p[4], linkedin_url: m.contact.linkedin, education: m.education, skills: m.skills_found, expected_salary: null,
      availability: i % 2 ? '30 days notice' : '2 weeks notice', resume_text: resume(p), avatar_color: U.colorFor(p[0]), created_at: created,
    });
    const stageIdx = U.STAGES.indexOf(p[7]);
    const aid = await db.insert('applications', {
      job_id: jobIds[p[1]], candidate_id: candId, company_id: cid, recruiter_id: sarah, stage: p[7], furthest_stage: stageIdx >= 0 ? stageIdx : 1,
      source: sources[i % sources.length], match_score: m.match_score, ats_score: m.ats_score, match_level: m.level, match_details: m, matched_at: created,
      ai_status: null, status_token: sec.randomToken(16), stage_changed_at: iso(-3), created_at: created, updated_at: created,
    });
    await db.insert('stage_history', { application_id: aid, from_stage: null, to_stage: 'applied', changed_at: created });
    if (p[7] !== 'applied') await db.insert('stage_history', { application_id: aid, from_stage: 'applied', to_stage: p[7], changed_by: sarah, changed_at: iso(-3) });
    if (p[7] === 'interview') {
      const offsetsH = { 0: 1, 3: 3, 4: 5, 9: -24 };
      const h = offsetsH[i] ?? 26;
      await db.insert('interviews', {
        application_id: aid, company_id: cid, interviewer_id: i % 2 ? sarah : marcus, scheduled_at: new Date(now + h * 3600000).toISOString(), duration_minutes: 45,
        type: i === 4 ? 'Cultural Fit' : 'Technical Interview', platform: i === 9 ? 'Zoom' : 'Jitsi Meet', meeting_link: `https://meet.jit.si/CareerBridge-${sec.randomToken(8)}`,
        status: h < 0 ? 'completed' : 'scheduled', created_by: sarah, created_at: iso(-3),
      });
      await db.insert('messages', { application_id: aid, company_id: cid, sender_type: 'recruiter', sender_id: sarah, subject: 'Interview invitation', body: `Hi ${p[0].split(' ')[0]}, thank you for applying. We'd love to invite you to an interview for the ${JOBS[p[1]][0]} role. The meeting link is on your application status page.`, channel: 'portal', sent_at: iso(-3) });
      await db.insert('messages', { application_id: aid, company_id: cid, sender_type: 'candidate', body: 'Thank you! I have confirmed the slot and look forward to it.', channel: 'portal', sent_at: iso(-2.5) });
    }
  }
  // ---- University placement cell + students (connected to the applications above) ----
  const uni = await db.insert('universities', { name: 'SRM Institute of Science and Technology, Ramapuram', code: 'SRMRMP', location: 'Chennai',
    officer_name: 'Placement Officer', officer_email: 'placement@srm.example.com', password_hash: pw, created_at: iso(-90) });
  const people = PEOPLE.filter((p) => /SRM|Anna University/.test(p[6]));
  for (const [k, p] of people.entries()) {
    const email = p[0].toLowerCase().replace(/[^a-z]+/g, '') + '@example.com';
    const stId = await db.insert('students', { university_id: uni, name: p[0], email: k === 0 ? 'student@example.com' : email, password_hash: pw, degree: 'B.Tech Information Technology',
      grad_year: 2027, location: 'Chennai', resume_text: resume(p), skills: p[5].split(', '), avatar_color: U.colorFor(p[0]), created_at: iso(-50) });
    await db.run('UPDATE applications SET student_id = ?, source = ? WHERE candidate_id IN (SELECT id FROM candidates WHERE name = ? AND company_id = ?)', [stId, 'Student Portal · SRM Ramapuram', p[0], cid]);
    if (k < 2) await db.insert('mock_interviews', { student_id: stId, role: JOBS[p[1]][0], questions: [], answers: [], score: 62 + k * 9, feedback: { verdict: 'Good fundamentals; add more examples with numbers.' }, status: 'completed', created_at: iso(-5) });
  }
  for (const [n, d] of [['Harini Prakash', 'B.Tech Computer Science'], ['Sanjay Kumar', 'B.Tech Electronics'], ['Meera Nair', 'BCA']]) {
    await db.insert('students', { university_id: uni, name: n, email: n.toLowerCase().replace(/[^a-z]+/g, '') + '@example.com', password_hash: pw, degree: d, grad_year: 2027, avatar_color: U.colorFor(n), created_at: iso(-20) });
  }
  console.log('Student demo: student@example.com / demo1234 · University demo: placement@srm.example.com / demo1234');
  await db.insert('notifications', { company_id: cid, recruiter_id: sarah, type: 'system', title: 'Welcome to CareerBridge', body: 'Add a free AI key in Settings to enable AI insights.', link: '/settings', is_read: 0, created_at: iso(0) });
  console.log('Demo login: sarah.jenkins@example.com / demo1234');
}

module.exports = { seed };
