begin;
alter table neutronium_employee_applications
  drop constraint neutronium_employee_applications_status_check,
  drop constraint neutronium_employee_applications_check,
  alter column user_id drop not null,
  alter column link_id drop not null,
  add column contact_email text not null default '',
  add column revision integer not null default 0,
  add column submitted_by uuid references neutronium_users(id),
  add constraint neutronium_application_status check(status in ('pending','in_review','more_info','accepted','declined')),
  add constraint neutronium_application_identity check(user_id is not null or contact_email <> ''),
  add constraint neutronium_application_decision check(
    (status in ('pending','in_review','more_info') and reviewed_at is null and reviewed_by is null and employee_id is null and job_id is null)
    or (status='declined' and reviewed_at is not null and reviewed_by is not null and employee_id is null and job_id is null)
    or (status='accepted' and reviewed_at is not null and reviewed_by is not null and employee_id is not null and job_id is not null));
drop index neutronium_employee_application_open;
create unique index neutronium_employee_application_open on neutronium_employee_applications(organization_id,user_id) where status in ('pending','in_review','more_info','accepted');
create unique index neutronium_employee_application_contact on neutronium_employee_applications(organization_id,lower(contact_email)) where user_id is null and status in ('pending','in_review','more_info','accepted');
commit;
