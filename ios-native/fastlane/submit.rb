require 'spaceship'

token = Spaceship::ConnectAPI::Token.create(
  key_id: "P4BW79M9KU",
  issuer_id: "7dca478c-0430-4412-be32-17c5bdbcebd5",
  filepath: File.expand_path("~/private_keys/AuthKey_P4BW79M9KU.p8"),
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
