"""Skill dictionary used by the CareerBridge resume matcher.

Each canonical skill maps to the aliases that may appear in a resume or a
job description. Matching is case-insensitive and respects word boundaries,
so "java" never matches inside "javascript" and "sql" never matches inside
"mysql".
"""

SKILLS = {
    # --- Programming languages -------------------------------------------
    "JavaScript": ["javascript", "ecmascript", "es6"],
    "TypeScript": ["typescript"],
    "Python": ["python", "python3"],
    "Java": ["java"],
    "C++": ["c++", "cpp"],
    "C#": ["c#", "csharp"],
    "Go": ["golang"],
    "Rust": ["rust"],
    "Kotlin": ["kotlin"],
    "Swift": ["swift"],
    "PHP": ["php"],
    "Ruby": ["ruby"],
    "Scala": ["scala"],
    "R": ["r programming", "rstudio"],
    "SQL": ["sql", "t-sql", "pl/sql"],
    "Bash": ["bash", "shell scripting"],
    # --- Frontend ------------------------------------------------------------
    "HTML": ["html", "html5"],
    "CSS": ["css", "css3"],
    "Sass": ["sass", "scss"],
    "Tailwind CSS": ["tailwind", "tailwind css", "tailwindcss"],
    "React": ["react", "react.js", "reactjs"],
    "Next.js": ["next.js", "nextjs"],
    "Vue.js": ["vue", "vue.js", "vuejs"],
    "Angular": ["angular", "angularjs"],
    "Redux": ["redux", "redux toolkit"],
    "React Native": ["react native"],
    "Flutter": ["flutter"],
    "Webpack": ["webpack"],
    "Vite": ["vite"],
    "Design Systems": ["design system", "design systems", "component library"],
    "Web Performance": ["web performance", "core web vitals", "web vitals", "performance optimization", "lighthouse"],
    "Accessibility": ["accessibility", "a11y", "wcag"],
    "Responsive Design": ["responsive design", "responsive web design", "mobile-first"],
    # --- Backend -------------------------------------------------------------
    "Node.js": ["node.js", "nodejs", "node js"],
    "Express": ["express", "express.js", "expressjs"],
    "Django": ["django"],
    "Flask": ["flask"],
    "FastAPI": ["fastapi"],
    "Spring Boot": ["spring boot", "spring"],
    ".NET": [".net", "asp.net", "dotnet"],
    "REST APIs": ["rest", "rest api", "rest apis", "restful", "restful apis"],
    "GraphQL": ["graphql"],
    "Microservices": ["microservices", "microservice"],
    "System Design": ["system design", "distributed systems", "scalable architecture"],
    "Authentication": ["oauth", "jwt", "authentication", "sso"],
    # --- Data & databases ----------------------------------------------------
    "MySQL": ["mysql"],
    "PostgreSQL": ["postgresql", "postgres"],
    "MongoDB": ["mongodb", "mongo"],
    "Redis": ["redis"],
    "Elasticsearch": ["elasticsearch", "opensearch"],
    "Snowflake": ["snowflake"],
    "BigQuery": ["bigquery"],
    "Apache Spark": ["spark", "pyspark", "apache spark"],
    "Hadoop": ["hadoop", "hdfs", "hive"],
    "Kafka": ["kafka"],
    "Airflow": ["airflow"],
    "dbt": ["dbt"],
    "ETL": ["etl", "elt", "data pipelines", "data pipeline"],
    "Data Modeling": ["data modeling", "data modelling", "dimensional modeling"],
    "Data Warehousing": ["data warehouse", "data warehousing"],
    "Pandas": ["pandas"],
    "NumPy": ["numpy"],
    "Excel": ["excel", "ms excel", "microsoft excel", "spreadsheets"],
    "Tableau": ["tableau"],
    "Power BI": ["power bi", "powerbi"],
    "Looker": ["looker"],
    "Data Analysis": ["data analysis", "data analytics", "analytics"],
    "Data Visualization": ["data visualization", "data visualisation", "dashboards"],
    "Statistics": ["statistics", "statistical analysis", "hypothesis testing"],
    "A/B Testing": ["a/b testing", "ab testing", "experimentation", "split testing"],
    # --- ML / AI -------------------------------------------------------------
    "Machine Learning": ["machine learning", "ml"],
    "Deep Learning": ["deep learning", "neural networks"],
    "PyTorch": ["pytorch"],
    "TensorFlow": ["tensorflow", "keras"],
    "scikit-learn": ["scikit-learn", "sklearn"],
    "NLP": ["nlp", "natural language processing"],
    "Computer Vision": ["computer vision", "opencv"],
    "LLMs": ["llm", "llms", "large language models", "generative ai", "genai", "prompt engineering"],
    "MLOps": ["mlops", "mlflow", "model deployment"],
    "Predictive Modeling": ["predictive modeling", "predictive modelling", "forecasting"],
    # --- Cloud & DevOps ------------------------------------------------------
    "AWS": ["aws", "amazon web services", "ec2", "s3", "lambda"],
    "Google Cloud": ["gcp", "google cloud"],
    "Azure": ["azure"],
    "Docker": ["docker", "containers"],
    "Kubernetes": ["kubernetes", "k8s"],
    "Terraform": ["terraform", "infrastructure as code"],
    "CI/CD": ["ci/cd", "continuous integration", "github actions", "jenkins", "gitlab ci"],
    "Linux": ["linux", "unix"],
    "Git": ["git", "github", "gitlab", "version control"],
    "Monitoring": ["prometheus", "grafana", "datadog", "observability", "monitoring"],
    "Testing": ["unit testing", "jest", "cypress", "playwright", "pytest", "test automation", "tdd"],
    # --- Design --------------------------------------------------------------
    "Figma": ["figma"],
    "Sketch": ["sketch"],
    "Adobe XD": ["adobe xd"],
    "Adobe Creative Suite": ["photoshop", "illustrator", "adobe creative suite", "after effects"],
    "UI Design": ["ui design", "visual design", "interface design", "user interface"],
    "UX Design": ["ux design", "user experience", "interaction design", "ux"],
    "User Research": ["user research", "usability testing", "user interviews", "ux research"],
    "Wireframing": ["wireframing", "wireframes"],
    "Prototyping": ["prototyping", "prototypes", "prototype"],
    "Information Architecture": ["information architecture"],
    "Product Design": ["product design"],
    # --- Product, marketing, business ---------------------------------------
    "Product Management": ["product management", "product roadmap", "roadmapping"],
    "SEO": ["seo", "search engine optimization"],
    "SEM": ["sem", "google ads", "paid search", "ppc"],
    "Google Analytics": ["google analytics", "ga4"],
    "Content Marketing": ["content marketing", "content strategy"],
    "Growth Marketing": ["growth marketing", "growth hacking", "user acquisition"],
    "Social Media": ["social media", "social media marketing"],
    "Email Marketing": ["email marketing", "marketing automation", "lifecycle marketing"],
    "Copywriting": ["copywriting"],
    "HubSpot": ["hubspot"],
    "Salesforce": ["salesforce"],
    "CRM": ["crm"],
    "Customer Success": ["customer success", "account management", "client relationship"],
    "Sales": ["sales", "business development", "lead generation"],
    "Negotiation": ["negotiation"],
    "Market Research": ["market research", "competitive analysis"],
    "Budgeting": ["budgeting", "budget management"],
    # --- Ways of working -----------------------------------------------------
    "Agile": ["agile", "scrum", "kanban", "sprint planning"],
    "Jira": ["jira", "confluence"],
    "Project Management": ["project management", "program management", "stakeholder management"],
    "Team Leadership": ["team leadership", "led a team", "leading teams", "people management", "mentoring", "mentored"],
    "Communication": ["communication", "presentation skills", "public speaking"],
    "Problem Solving": ["problem solving", "problem-solving", "critical thinking"],
    "Cross-functional Collaboration": ["cross-functional", "cross functional", "stakeholder collaboration"],
}


def build_alias_index():
    """Return a list of (canonical, alias) pairs sorted longest alias first."""
    pairs = []
    for canonical, aliases in SKILLS.items():
        seen = set()
        for alias in [canonical.lower()] + aliases:
            a = alias.lower().strip()
            if a and a not in seen:
                seen.add(a)
                pairs.append((canonical, a))
    pairs.sort(key=lambda p: -len(p[1]))
    return pairs


ALIAS_INDEX = build_alias_index()
CANONICAL_BY_ALIAS = {alias: canonical for canonical, alias in ALIAS_INDEX}
