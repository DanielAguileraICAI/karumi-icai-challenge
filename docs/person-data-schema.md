# Person data: what we know before the demo

All records in `data/crm.json` are invented. `agent-app/profile.js` turns one record into the profile the demo engine uses (`toProfile`), and says for each choice where it came from and how sure we are (`sources`).

| Block | Field | Where it comes from | Feeds |
|---|---|---|---|
| contact | first_name, last_name | CRM | name |
| contact | email | CRM | (shown only) |
| contact | job_title | CRM | title, role, knowledge (technical titles mean expert) |
| contact | seniority | enrichment | decision |
| contact | department | CRM | role (when the title is unclear) |
| contact | linkedin_headline | enrichment | (shown only) |
| contact | language | CRM | language |
| contact | country, timezone | enrichment | (shown only) |
| company | name | CRM | company |
| company | domain | CRM | (shown only) |
| company | industry | enrichment | sector |
| company | employees | enrichment | size |
| company | revenue_band, country, funding_stage, hiring_trend | enrichment | (shown only) |
| company | current_hr_tool, current_finance_tool | enrichment | knowledge (none or spreadsheets: novice; one suite: familiar; two: expert) |
| company | tech_stack | enrichment | (shown only) |
| activity | source | web analytics | stage (a G2 comparison means comparing) |
| activity | first_seen, content_downloaded, emails_opened, previous_demos | web analytics | (shown only) |
| activity | pages_visited | web analytics | concern, when the form says nothing (pricing: cost, security: security, integrations: integration) |
| activity | crm_stage | CRM | stage (negotiation, or opportunity this month: deciding) |
| activity | deal_owner, open_opportunity_value_eur | CRM | (shown only) |
| form | what_brings_you | demo form | concern (keywords first, for example "audit" means compliance) |
| form | team_size_answer | demo form | (shown only) |
| form | timeline | demo form | stage |
| form | who_else_decides | demo form | decision ("my boss": researcher; "I use it": user; senior and alone: decider; others sign: influencer) |
| form | biggest_pain | demo form | note, and concern if the first answer had no keyword |

Order when sources disagree for concern: what the person wrote, then the pages they visited, then a default for their role. Minutes is always 3.
