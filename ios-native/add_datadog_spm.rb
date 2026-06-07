require 'xcodeproj'
project_path = 'PrismAAC.xcodeproj'
project = Xcodeproj::Project.open(project_path)

package = project.root_object.package_references.find do |p|
  p.respond_to?(:repositoryURL) && p.repositoryURL == 'https://github.com/DataDog/dd-sdk-ios.git'
end
unless package
  package = project.new(Xcodeproj::Project::Object::XCRemoteSwiftPackageReference)
  package.repositoryURL = 'https://github.com/DataDog/dd-sdk-ios.git'
  package.requirement = { "kind" => "upToNextMajorVersion", "minimumVersion" => "2.0.0" }
  project.root_object.package_references << package
end

target = project.targets.find { |t| t.name == 'PrismAAC' }

['DatadogCore', 'DatadogRUM', 'DatadogCrashReporting', 'DatadogWebViewTracking'].each do |product_name|
  product_dep = target.package_product_dependencies.find { |d| d.product_name == product_name }
  unless product_dep
    product_dep = project.new(Xcodeproj::Project::Object::XCSwiftPackageProductDependency)
    product_dep.product_name = product_name
    product_dep.package = package
    target.package_product_dependencies << product_dep
    
    build_phase = target.frameworks_build_phase
    file_ref = project.new(Xcodeproj::Project::Object::PBXBuildFile)
    file_ref.product_ref = product_dep
    build_phase.files << file_ref
  end
end

project.save
puts "Successfully added Datadog to PrismAAC"
