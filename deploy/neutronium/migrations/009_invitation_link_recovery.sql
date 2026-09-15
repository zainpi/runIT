begin;

alter table neutronium_onboarding_links
  add column token_ciphertext text,
  add column token_key_version text,
  add constraint neutronium_onboarding_token_recovery_pair check(
    (token_ciphertext is null and token_key_version is null)
    or (token_ciphertext is not null and token_key_version is not null)
  );

commit;
