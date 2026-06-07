require 'xcodeproj'
project_path = 'PrismAAC.xcodeproj'
project = Xcodeproj::Project.open(project_path)
target = project.targets.find { |t| t.name == 'PrismAAC' }
if target
  group = project.main_group.find_subpath(File.join('PrismAAC', 'Sources', 'Views'), true)
  file_ref = group.new_file('InworldSTTClient.swift')
  target.add_file_references([file_ref])
  project.save
  puts "Added InworldSTTClient.swift to PrismAAC target"
else
  puts "Target not found"
end
