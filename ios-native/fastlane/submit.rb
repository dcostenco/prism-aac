require 'spaceship'

token = Spaceship::ConnectAPI::Token.create(
  # Admin-level App Store Connect API key, from the environment: ASC_ADMIN_KEY_ID and ASC_ISSUER_ID.
  # The .p8 is ~/private_keys/AuthKey_<id>.p8 unless ASC_ADMIN_KEY_PATH is set.
  key_id: ENV.fetch("ASC_ADMIN_KEY_ID"),
  issuer_id: ENV.fetch("ASC_ISSUER_ID"),
  filepath: File.expand_path(ENV.fetch("ASC_ADMIN_KEY_PATH") { "~/private_keys/AuthKey_#{ENV.fetch('ASC_ADMIN_KEY_ID')}.p8" }),
  in_house: false
)
Spaceship::ConnectAPI.token = token

app = Spaceship::ConnectAPI::App.find("ai.synalux.prism-aac")
version = app.get_edit_app_store_version

puts "Version: #{version.version_string}"

locs = version.get_app_store_version_localizations
locs.each do |loc|
  loc.update(whats_new: "Bug fixes and performance improvements.")
  puts "Updated whats_new for #{loc.locale}"
end

puts "Submitting for review..."
begin
  submission = app.create_review_submission
  submission.add_app_store_version_to_review_items(app_store_version_id: version.id)
  submission.submit_for_review
  puts "Submitted successfully!"
rescue => e
  puts "Error submitting: #{e.message}"
end
