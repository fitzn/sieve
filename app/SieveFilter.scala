import java.io.File

case class SieveFilterConfig(
  keepOnly2xx: Boolean,
  ipPrefixBlockFilePath: Option[String]
)

class SieveFilter(config: SieveFilterConfig) {

  private val blockedPrefixIPs = config.ipPrefixBlockFilePath.map(path => {
    try {
      scala.io.Source.fromFile(new File(path)).getLines.toList.
        filter(_.trim.nonEmpty).
        filterNot(_.startsWith("#")).
        toSet
    } catch {
      case e: Exception => {
        println(s"error: failed to load IP prefix block file $path")
        Set.empty[String]
      }
    }
  }).getOrElse(Set.empty[String])

  def isBlocked(request: LoggedRequest): Boolean = {
    (config.keepOnly2xx && (request.sc_status / 100) != 2) ||
      (request.c_ip.exists(ip => blockedPrefixIPs.exists(ip.startsWith)))
  }
}
