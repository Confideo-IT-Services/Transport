import { useState, useEffect } from "react";
import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, Eye, X, Calendar, Filter, Loader2, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { registrationLinksApi, classesApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

interface RegistrationLink {
  id: string;
  linkCode: string;
  classId: string;
  className: string;
  classSection: string;
  fieldConfig: any[];
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  link: string;
}

export default function RegistrationLinksManagement() {
  const { user } = useAuth();
  const [links, setLinks] = useState<RegistrationLink[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [filteredLinks, setFilteredLinks] = useState<RegistrationLink[]>([]);
  const [selectedClass, setSelectedClass] = useState("all");
  const [selectedSection, setSelectedSection] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingLinks, setIsLoadingLinks] = useState(false);
  const [hasLoadedLinks, setHasLoadedLinks] = useState(false);

  useEffect(() => {
    // Only load classes on mount, not links
    loadClasses();
  }, []);

  const loadClasses = async () => {
    setIsLoading(true);
    try {
      const classesData = await classesApi.getAll().catch(() => []);
      setClasses(classesData);
    } catch (error) {
      console.error('Failed to load classes:', error);
      setClasses([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadForms = async () => {
    if (selectedClass === "all") {
      toast.error("Please select a class");
      return;
    }

    setIsLoadingLinks(true);
    try {
      // Fetch all links
      let linksData: RegistrationLink[] = [];
      try {
        linksData = await registrationLinksApi.getAll();
        console.log('✅ All links fetched:', linksData);
      } catch (error: any) {
        console.error('❌ Error fetching links:', error);
        toast.error(error?.message || "Failed to load registration links. Please check the backend server.");
        setLinks([]);
        setFilteredLinks([]);
        setIsLoadingLinks(false);
        return;
      }
      
      console.log('Selected class:', selectedClass);
      console.log('Selected section:', selectedSection);
      
      // Filter by class name directly (not by matching IDs)
      // The backend returns className from the JOIN, so we can filter directly
      let filtered = linksData.filter((link: RegistrationLink) => {
        const matches = link.className === selectedClass;
        console.log(`Link ${link.linkCode}: className="${link.className}" matches "${selectedClass}": ${matches}`);
        return matches;
      });

      console.log('Filtered by class:', filtered);

      // Filter by section if selected
      if (selectedSection !== "all") {
        filtered = filtered.filter((link: RegistrationLink) => {
          const matches = link.classSection === selectedSection;
          console.log(`Link ${link.linkCode}: classSection="${link.classSection}" matches "${selectedSection}": ${matches}`);
          return matches;
        });
      }

      console.log('Filtered by section:', filtered);

      // Sort by date/time (most recent first)
      filtered.sort((a: RegistrationLink, b: RegistrationLink) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA; // Descending order (newest first)
      });

      setLinks(filtered);
      setFilteredLinks(filtered);
      setHasLoadedLinks(true);
      
      if (filtered.length === 0) {
        toast.info(`No registration links found for ${selectedClass}${selectedSection !== "all" ? ` - Section ${selectedSection}` : ""}`);
      } else {
        toast.success(`Loaded ${filtered.length} registration link(s)`);
      }
    } catch (error: any) {
      console.error('❌ Failed to load links:', error);
      toast.error(error?.message || "Failed to load registration links");
      setLinks([]);
      setFilteredLinks([]);
    } finally {
      setIsLoadingLinks(false);
    }
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success("Link copied to clipboard!");
  };

  const handleDeactivate = async (linkId: string) => {
    if (!confirm("Are you sure you want to deactivate this registration link?")) {
      return;
    }

    try {
      await registrationLinksApi.deactivate(linkId);
      toast.success("Registration link deactivated");
      // Reload links for the current selection
      await handleLoadForms();
    } catch (error: any) {
      console.error('Error deactivating link:', error);
      toast.error(error?.message || "Failed to deactivate link");
    }
  };

  const handleDelete = async (linkId: string) => {
    if (!confirm("Are you sure you want to delete this registration link? This action cannot be undone.")) {
      return;
    }

    try {
      await registrationLinksApi.delete(linkId);
      toast.success("Registration link deleted");
      // Reload links for the current selection
      await handleLoadForms();
    } catch (error: any) {
      console.error('Error deleting link:', error);
      toast.error(error?.message || "Failed to delete link");
    }
  };

  // Get unique sections for selected class
  const getSectionsForClass = () => {
    if (selectedClass === "all") return [];
    
    // Get all sections for the selected class name
    const classSections = classes
      .filter(c => c.name === selectedClass)
      .map(c => c.section)
      .filter(s => s);
    
    return [...new Set(classSections)].sort();
  };

  const sections = getSectionsForClass();

  // Get unique class names
  const uniqueClassNames = [...new Set(classes.map(c => c.name))].sort();

  return (
    <UnifiedLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Registration Links</h1>
            <p className="text-muted-foreground mt-1">
              Select class and section to view registration links.
            </p>
          </div>
        </div>

        {/* Class and Section Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Select Class and Section
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Class Selection */}
              <Select value={selectedClass} onValueChange={(value) => {
                setSelectedClass(value);
                setSelectedSection("all"); // Reset section when class changes
                setHasLoadedLinks(false); // Reset loaded state
                setLinks([]);
                setFilteredLinks([]);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {uniqueClassNames.map((className) => (
                    <SelectItem key={className} value={className}>
                      {className}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Section Selection */}
              <Select 
                value={selectedSection} 
                onValueChange={(value) => {
                  setSelectedSection(value);
                  setHasLoadedLinks(false); // Reset loaded state
                  setLinks([]);
                  setFilteredLinks([]);
                }}
                disabled={selectedClass === "all" || sections.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sections</SelectItem>
                  {sections.map((section) => (
                    <SelectItem key={section} value={section}>
                      Section {section}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Load Forms Button */}
              <Button 
                onClick={handleLoadForms}
                disabled={selectedClass === "all" || isLoadingLinks}
                className="w-full"
              >
                {isLoadingLinks ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Filter className="w-4 h-4 mr-2" />
                    Load Forms
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Links List */}
        {isLoadingLinks ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading registration links...</p>
            </div>
          </div>
        ) : !hasLoadedLinks ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Link2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Select Class and Load Forms</h3>
              <p className="text-muted-foreground">
                Please select a class (and optionally a section) and click "Load Forms" to view registration links.
              </p>
            </CardContent>
          </Card>
        ) : filteredLinks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Link2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No registration links found</h3>
              <p className="text-muted-foreground">
                No registration links found for {selectedClass}{selectedSection !== "all" ? ` - Section ${selectedSection}` : ""}.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredLinks.map((link) => (
              <Card key={link.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{link.className}</h3>
                        {link.classSection && (
                          <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">
                            Section {link.classSection}
                          </span>
                        )}
                        {link.isActive ? (
                          <span className="px-2 py-1 text-xs rounded-full bg-success/10 text-success">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs rounded-full bg-muted text-muted-foreground">
                            Inactive
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Link Code:</span>
                          <code className="px-2 py-1 bg-muted rounded text-xs font-mono">
                            {link.linkCode}
                          </code>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>
                            Created: {new Date(link.createdAt).toLocaleString()}
                          </span>
                          {link.expiresAt && (
                            <>
                              <span>•</span>
                              <span>
                                Expires: {new Date(link.expiresAt).toLocaleDateString()}
                              </span>
                            </>
                          )}
                        </div>
                        <div>
                          <span className="font-medium">Fields configured:</span>{" "}
                          {link.fieldConfig?.length || 0} fields
                        </div>
                      </div>

                      <div className="mt-4 p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Link2 className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Registration URL:</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-xs font-mono bg-background px-2 py-1 rounded break-all">
                            {link.link}
                          </code>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleCopyLink(link.link)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                      {link.isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeactivate(link.id)}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Deactivate
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(link.link, '_blank')}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Form
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(link.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Summary */}
        {hasLoadedLinks && filteredLinks.length > 0 && (
          <div className="text-sm text-muted-foreground text-center">
            Showing {filteredLinks.length} registration link(s) for {selectedClass}{selectedSection !== "all" ? ` - Section ${selectedSection}` : ""}
          </div>
        )}
      </div>
    </UnifiedLayout>
  );
}
