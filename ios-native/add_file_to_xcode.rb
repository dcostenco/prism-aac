require 'xcodeproj'
project_path = 'PrismAAC.xcodeproj'
project = Xcodeproj::Project.open(project_path)
target = project.targets.find { |t| t.name == 'PrismAAC' }

group = project.main_group.find_subpath(File.join('PrismAAC', 'Sources', 'App'), true)
file_ref = group.new_file('DatadogLogger.swift')
target.add_file_references([file_ref])
project.save
puts "Added DatadogLogger.swift to PrismAAC target"
