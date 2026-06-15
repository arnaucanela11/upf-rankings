# UPF Ranking Simulator

Practical web tool developed as part of the Final Degree Project **“Analyzing and Predicting University Rankings (QS and THE): Building a Strategy for UPF”**.

The application allows users to explore university ranking data, compare institutions, simulate alternative ranking scenarios, and evaluate how changes in indicators or model assumptions may affect university positions. The tool is focused on QS and Times Higher Education (THE) rankings, with Universitat Pompeu Fabra (UPF) used as the main case study.

Live application: https://upf-rankings.vercel.app/

---

## 1. Purpose of the tool

Global university rankings are built from several weighted indicators. However, their final scores are highly aggregated, and the raw mechanisms behind each pillar are not always fully transparent.

This tool was created to make the analysis more operational. Instead of leaving the thesis results as a static report, the simulator allows users to:

* Explore QS and THE ranking datasets.
* Compare universities and ranking editions.
* Analyse UPF’s position relative to other institutions.
* Simulate “what-if” scenarios by modifying weights, indicators or model assumptions.
* Visualise ranking distributions and score gaps.
* Use predictive models based on observable proxy variables.

The goal is not to reproduce the official QS or THE algorithms exactly, but to provide a transparent analytical environment for understanding ranking dynamics and testing strategic scenarios.

---

## 2. Main features

### Ranking explorer

Allows users to browse university ranking data by ranking system, edition and view. It includes institutional information, indicator scores, overall results and export options.

### Scenario simulator

Allows users to create default or custom scenarios. Scenarios can modify assumptions such as indicator weights, formulas or input values to estimate how ranking outcomes could change.

### Reports page

Provides visual summaries of ranking results, including:

* UPF’s position and score distribution.
* Scenario-based comparisons.
* Top universities and countries.
* Ranking distribution charts.

### User access management

Access is managed through Firebase Authentication. Users must be previously created by an administrator in the Firebase project. Credentials and access passwords should be managed internally and must not be published in the repository.

---

## 3. Methodological overview

The methodology behind the tool follows the analytical structure of the thesis.

### 3.1 Ranking methodology analysis

The project first studies the official QS and THE ranking structures. QS is based on a set of separate indicators, including academic reputation, employer reputation, faculty-student ratio, citations per faculty, internationalisation, employment outcomes and sustainability. THE groups its indicators into broader pillars, mainly Teaching, Research Environment, Research Quality, International Outlook and Industry.

This comparison is used to understand what each ranking rewards and how their methodological structures differ.

### 3.2 Descriptive and exploratory analysis

The datasets were cleaned and inspected before modelling. The exploratory analysis included:

* Missing value detection and removal.
* Distribution analysis of numerical variables.
* Outlier detection.
* Correlation analysis between ranking indicators and proxy variables.
* Multicollinearity checks between predictors.
* Variable transformations for skewed variables when needed.

This step ensured that the final modelling dataset was consistent and not dominated by extreme observations or redundant predictors.

### 3.3 Proxy variables

Since many ranking inputs are highly aggregated or not fully observable, the project builds a set of supplementary proxy variables. These variables approximate dimensions such as:

* Teaching capacity.
* Research output.
* Research impact.
* Internationalisation.
* Employability.
* Sustainability.
* Institutional and country context.

Examples include student-to-staff ratio, estimated staff, publications, citations, H-index, research productivity, international co-authorship, alumni impact and carbon neutrality targets.

Most bibliometric variables were obtained from public databases such as OpenAlex, while other variables were collected from QS/THE profiles, public institutional sources and web scraping.

### 3.4 Predictive modelling

Several models were tested to predict ranking position from observable variables:

* Linear regression.
* Stepwise regression using AIC and BIC.
* Generalized Additive Model (GAM).
* Random Forest.
* Neural Network.

Models were evaluated using train/test split and cross-validation. The main evaluation metrics were:

* RMSE.
* MAE.
* R².

The best-performing models were included in the tool as alternative ways to generate ranking projections and scenario outputs.

---

## 4. Technical architecture

The application is built with:

* **Next.js** for the frontend and application layer.
* **Firebase Authentication** for user login and access control.
* **Cloud Firestore** for storing users, rankings, universities, indicators, parameters, scenarios and model outputs.
* **R, Stata and Python** for offline data cleaning, exploratory analysis, modelling and export of model results.

The analytical scripts are not part of the real-time backend. They are used offline to prepare datasets, estimate models and generate outputs that are later integrated into the application.

---

## 5. Repository structure

```text
upf-rankings/
├── app/                 # Next.js app routes and pages
├── components/          # Reusable UI components
├── data/rankings/       # Ranking datasets and processed data
├── lib/                 # Utility functions and application logic
├── public/              # Static assets
├── scripts/             # Data processing and support scripts
├── package.json         # Project dependencies and commands
└── README.md            # Project documentation
```

---

## 6. Getting started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

---

## 7. Environment variables

The project requires Firebase configuration variables. These should be stored in a local `.env` file and should not be committed to the repository.

Example structure:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

---

## 8. Data sources

The project uses ranking and supplementary datasets from several sources:

* QS World University Rankings.
* Times Higher Education World University Rankings.
* QS/THE institutional profiles.
* OpenAlex public database.
* Public institutional websites.
* Web-scraped public information.
* Manually collected ranking data where necessary.

All datasets used in the thesis and in the practical tool are included in the repository or referenced through the data-processing workflow.

---

## 9. Limitations

The simulator is an analytical and educational tool. It does not claim to replicate the proprietary QS or THE ranking algorithms exactly.

Main limitations:

* Some official ranking inputs are not publicly available.
* Several variables are proxies rather than exact official indicators.
* Predictive models estimate likely ranking behaviour, not official future results.
* Web-scraped and public data may contain inconsistencies or require manual validation.
* Ranking providers may change their methodology across editions.

---

## 10. Project context

This repository is part of a Final Degree Project at Universitat Pompeu Fabra. The tool was designed to give practical continuity to the thesis by allowing users to interact with the data, test scenarios and explore strategic implications for UPF.

---

## 11. Authors

Developed by:

* Arnau Canela Daunis
* Tomas Coffey Lleopart
* Victor Gimeno Ruiz
* Eric Canosa Fuentes

Tutor:

* Isaac Baley

Universitat Pompeu Fabra
Bachelor’s Degree Final Thesis

---

## 12. License

This project is released under the MIT License.
