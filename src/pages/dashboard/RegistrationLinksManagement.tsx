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
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { registrationLinksApi, classesApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

type FilterLinkType = 'all_classes_filter' | 'specific_class_filter' | 'teacher_filter' | 'others_filter';

interface RegistrationLink {
  id: string;
  linkCode: string;
  linkType?: 'class' | 'all_classes' | 'teacher' | 'others';
  name?: string;
  teacherId?: string;
  teacherName?: string;
  classId?: string;
  className?: string;
  classSection?: string;
  fieldConfig: any[];
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  link: string;
}

export default function RegistrationLinksManagement() {
  const { user } = useAuth();
  const { dialog, confirm, close } = useConfirmDialog();
  const [links, setLinks] = useState<RegistrationLink[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [filteredLinks, setFilteredLinks] = useState<RegistrationLink[]>([]);
  const [filterLinkType, setFilterLinkType] = useState<FilterLinkType>('all_classes_filter');
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
    if (filterLinkType === 'specific_class_filter' && selectedClass === "all") {
      toast.error("Please select a class");
      return;
    }

    setIsLoadingLinks(true);
    try {
      let linksData: RegistrationLink[] = [];
      try {
        linksData = await registrationLinksApi.getAll();
      } catch (error: any) {
        console.error('Error fetching links:', error);
        toast.error(error?.message || "Failed to load registration links. Please check the backend server.");
        setLinks([]);
        setFilteredLinks([]);
        setIsLoadingLinks(false);
        return;
      }

      // Filter by link type
      let filtered = linksData.filter((link: RegistrationLink) => {
        const type = link.linkType ?? 'class';
        switch (filterLinkType) {
          case 'all_classes_filter':
            return type === 'class' || type === 'all_classes';
          case 'specific_class_filter':
            if (type !== 'class') return false;
            if (link.className !== selectedClass) return false;
            if (selectedSection !== "all" && link.classSection !== selectedSection) return false;
            return true;
          case 'teacher_filter':
            return type === 'teacher';
          case 'others_filter':
            return type === 'others';
          default:
            return true;
        }
      });

      filtered.sort((a: RegistrationLink, b: RegistrationLink) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });

      setLinks(filtered);
      setFilteredLinks(filtered);
      setHasLoadedLinks(true);

      if (filtered.length === 0) {
        const filterLabel = filterLinkType === 'specific_class_filter'
          ? `${selectedClass}${selectedSection !== "all" ? ` - Section ${selectedSection}` : ""}`
          : filterLinkType === 'all_classes_filter' ? 'all classes' : filterLinkType === 'teacher_filter' ? 'teachers' : 'others';
        toast.info(`No registration links found for ${filterLabel}`);
      } else {
        toast.success(`Loaded ${filtered.length} registration link(s)`);
      }
    } catch (error: any) {
      console.error('Failed to load links:', error);
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
    confirm(
      "Deactivate Registration Link",
      "Are you sure you want to deactivate this registration link?",
      async () => {
        try {
          await registrationLinksApi.deactivate(linkId);
          toast.success("Registration link deactivated");
          // Reload links for the current selection
          await handleLoadForms();
        } catch (error: any) {
          console.error('Error deactivating link:', error);
          toast.error(error?.message || "Failed to deactivate link");
        }
      }
    );
  };

  const handleDelete = async (linkId: string) => {
    confirm(
      "Delete Registration Link",
      "Are you sure you want to delete this registration link? This action cannot be undone.",
      async () => {
        try {
          await registrationLinksApi.delete(linkId);
          toast.success("Registration link deleted");
          // Reload links for the current selection
          await handleLoadForms();
        } catch (error: any) {
          console.error('Error deleting link:', error);
          toast.error(error?.message || "Failed to delete link");
        }
      },
      {
        variant: "destructive",
        confirmText: "Delete",
      }
    );
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
              Filter by link type (all classes, specific class, teachers, or others) and load registration links.
            </p>
          </div>
        </div>

        {/* Filter and Load */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Show links for
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`grid grid-cols-1 gap-4 ${filterLinkType === 'specific_class_filter' ? 'md:grid-cols-4' : 'md:grid-cols-2'}`}>
              {/* Show links for */}
              <Select
                value={filterLinkType}
                onValueChange={(value: FilterLinkType) => {
                  setFilterLinkType(value);
                  setHasLoadedLinks(false);
                  setLinks([]);
                  setFilteredLinks([]);
                  if (value !== 'specific_class_filter') {
                    setSelectedClass("all");
                    setSelectedSection("all");
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Show links for" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_classes_filter">All classes</SelectItem>
                  <SelectItem value="specific_class_filter">Specific class</SelectItem>
                  <SelectItem value="teacher_filter">Teachers</SelectItem>
                  <SelectItem value="others_filter">Others</SelectItem>
                </SelectContent>
              </Select>

              {/* Class Selection - only when Specific class */}
              {filterLinkType === 'specific_class_filter' && (
                <Select
                  value={selectedClass}
                  onValueChange={(value) => {
                    setSelectedClass(value);
                    setSelectedSection("all");
                    setHasLoadedLinks(false);
                    setLinks([]);
                    setFilteredLinks([]);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Select Class</SelectItem>
                    {uniqueClassNames.map((className) => (
                      <SelectItem key={className} value={className}>
                        {className}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Section Selection - only when Specific class */}
              {filterLinkType === 'specific_class_filter' && (
                <Select
                  value={selectedSection}
                  onValueChange={(value) => {
                    setSelectedSection(value);
                    setHasLoadedLinks(false);
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
              )}

              {/* Load Forms Button */}
              <Button
                onClick={handleLoadForms}
                disabled={
                  (filterLinkType === 'specific_class_filter' && selectedClass === "all") ||
                  isLoadingLinks
                }
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
              <h3 className="text-lg font-semibold mb-2">Show links for and Load Forms</h3>
              <p className="text-muted-foreground">
                Choose a filter (All classes, Specific class, Teachers, or Others), optionally select class/section for specific class, then click "Load Forms" to view registration links.
              </p>
            </CardContent>
          </Card>
        ) : filteredLinks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Link2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No registration links found</h3>
              <p className="text-muted-foreground">
                No registration links found for{" "}
                {filterLinkType === "specific_class_filter"
                  ? `${selectedClass}${selectedSection !== "all" ? ` - Section ${selectedSection}` : ""}`
                  : filterLinkType === "all_classes_filter"
                    ? "all classes"
                    : filterLinkType === "teacher_filter"
                      ? "teachers"
                      : "others"}
                .
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
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="font-semibold text-lg">
                          {link.linkType === 'teacher' && link.teacherName
                            ? link.teacherName
                            : link.linkType === 'others' && link.name
                              ? link.name || 'Others'
                              : link.className || link.name || 'Class'}
                        </h3>
                        {link.linkType === 'class' || link.linkType === 'all_classes' ? (
                          link.classSection && (
                            <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">
                              Section {link.classSection}
                            </span>
                          )
                        ) : (
                          <span className="px-2 py-1 text-xs rounded-full bg-muted text-muted-foreground">
                            {link.linkType === 'teacher' ? 'Teacher' : link.linkType === 'others' ? 'Others' : link.linkType === 'all_classes' ? 'All classes' : 'Class'}
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
            Showing {filteredLinks.length} registration link(s) for{" "}
            {filterLinkType === "specific_class_filter"
              ? `${selectedClass}${selectedSection !== "all" ? ` - Section ${selectedSection}` : ""}`
              : filterLinkType === "all_classes_filter"
                ? "all classes"
                : filterLinkType === "teacher_filter"
                  ? "teachers"
                  : "others"}
          </div>
        )}
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={dialog.open}
        onOpenChange={(open) => !open && close()}
        title={dialog.title}
        description={dialog.description}
        onConfirm={dialog.onConfirm}
        confirmText={dialog.confirmText}
        cancelText={dialog.cancelText}
        variant={dialog.variant}
      />
    </UnifiedLayout>
  );
}
